# Plan 05 — Sub-phase 2: Prisma schema + migrations + FTS

**Parent:** [`05-apps-api.md`](2026-04-25-implementation/05-apps-api.md)
**Cut:** A (by-layer sub-phasing). This is sub-phase 2 of 6.
**Depends on:** sub-phase 1 (`471344f feat(api): scaffold platform skeleton`).
**Reference:** §21 (Database schema) of [`2026-04-25-rubik-platform-mvp-design.md`](2026-04-25-rubik-platform-mvp-design.md).

## Problem

Sub-phase 1 left `apps/api/prisma/schema.prisma` as a placeholder so `prisma generate` could produce a client at boot. The api now scaffolds and `/healthz` returns 200, but `/readyz` fails because there is no schema to migrate and the Compose Postgres on host port `5432` collides with the host's own Postgres install.

Sub-phase 2 lands the persistence layer: the canonical §21.2 schema, two migrations (auto DDL + raw-SQL FTS), and a port move so the Compose container can actually bind. After this sub-phase, `make dev.api` boots cleanly and `/readyz` returns 200.

## Goal

A migrated database that matches §21.2 exactly, with FTS infrastructure in place, ready for the catalog/auth/me modules in sub-phases 3–6.

## Deliverables

```
apps/api/prisma/
├── schema.prisma                        # full §21.2 transcription
└── migrations/
    ├── <ts>_init_schema/migration.sql   # auto DDL
    └── <ts>_add_fts/migration.sql       # raw SQL per §21.3
docker-compose.yaml                      # postgres → 5433:5432
apps/api/.env.example                    # localhost:5433
apps/api/.env                            # localhost:5433 (gitignored)
```

No code under `src/` changes. `PrismaService` stays as-is and gains typed models for free once the schema is in place.

## Approach

### 1. Move Compose Postgres to host port 5433

The host has Postgres on `:5432` already. Bump the Compose mapping to `5433:5432` so the container binds without sudo.

```yaml
postgres:
  ports:
    - '5433:5432'
```

Update `apps/api/.env.example`:

```
DATABASE_URL=postgres://rubik:rubik@localhost:5433/rubik
DIRECT_URL=postgres://rubik:rubik@localhost:5433/rubik
```

Mirror the same change into the local (gitignored) `apps/api/.env`. Note in the commit body so the next clone knows to use `:5433`.

Why: Compose dev DB stays isolated from any host Postgres. Zero impact on production wiring (Neon URL has its own host:port).

### 2. Author the §21.2 schema

Replace the placeholder. The schema is transcribed verbatim from §21.2; no design changes. Highlights:

- `generator client` enables `previewFeatures = ["fullTextSearchPostgres", "relationJoins"]`.
- 8 models: `Puzzle`, `Method`, `AlgorithmSet`, `AlgorithmCase`, `AlgorithmVariant`, `User`, `UserAlgorithm`, `RefreshToken`.
- 2 enums: `RecognitionBasis` (LAST_LAYER, F2L_SLOT, OLL_ORIENTATION, PLL_PERMUTATION, CROSS, OTHER), `LearningStatus` (LEARNING, LEARNED, MASTERED).
- Naming follows `040-prisma-rule.md`: singular PascalCase models, camelCase fields, snake_case tables via `@@map`, SCREAMING enum values.
- Cascade rules: catalog edges (`Puzzle → Method → Set → Case → Variant`) all `onDelete: Cascade`. `UserAlgorithm.chosenVariantId → SetNull`. `User → UserAlgorithm` and `User → RefreshToken` cascade.
- Indexes per §21.4 modeled in Prisma: catalog tables get composite `(parentId, slug)` uniques + `(parentId, displayOrder)` indexes; `algorithm_cases.tags` gets `@@index([tags], type: Gin)`; `users.email` and `users.googleSub` are single-field uniques; `refresh_tokens.tokenHash` is a single-field unique with a `(userId, expiresAt)` composite index for cleanup.
- A comment in the file points at `add_fts` for the `search_vector` + trigram indexes that Prisma cannot model.

### 3. Initial migration: `init_schema`

```
pnpm --filter @rubik/api prisma migrate dev --name init_schema
```

Produces `prisma/migrations/<ts>_init_schema/migration.sql` with the auto-generated DDL — tables, enums, FKs, the GIN index on `tags`, all unique/composite indexes. No hand edits.

Why a single migration for the whole catalog + auth: the bootstrap is one logical change ("the database exists"). Splitting it into `init_catalog` and `init_users` would force interleaving with the auth module work that doesn't land for two more sub-phases.

### 4. FTS migration: `add_fts`

```
pnpm --filter @rubik/api prisma migrate dev --create-only --name add_fts
```

`--create-only` produces an empty SQL file; hand-edit it to the §21.3 contents:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Postgres requires every function inside a STORED generated column to be
-- IMMUTABLE. array_to_string() is STABLE, so we wrap it.
CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE
  RETURN array_to_string(arr, sep);

ALTER TABLE algorithm_cases
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('english', immutable_array_to_string(coalesce(tags, '{}'), ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce("recognitionMd", '')), 'C')
  ) STORED;

CREATE INDEX algorithm_cases_search_vector_idx
  ON algorithm_cases USING GIN (search_vector);

CREATE INDEX algorithm_cases_name_trgm_idx
  ON algorithm_cases USING GIN (name gin_trgm_ops);

CREATE INDEX algorithm_cases_display_name_trgm_idx
  ON algorithm_cases USING GIN ("displayName" gin_trgm_ops);
```

Then `prisma migrate dev` applies it. Future `prisma migrate diff` runs will see the `search_vector` column as drift unless we tell it to ignore — Prisma's stance is that schema-modeled state is the source of truth, and raw-SQL state lives outside that. Acceptable per §21.3; revisit only if it becomes painful.

Why a separate migration: §21.3 specifies it explicitly, `040-prisma-rule.md` reinforces "one migration per logical change," and the FTS slice is the canonical example of "what Prisma can't model" that would otherwise contaminate the auto-generated migration on every future change.

### 5. Verification

After both migrations apply:

- `psql postgres://rubik:rubik@localhost:5433/rubik -c '\dt'` lists 8 expected tables.
- `psql ... -c '\dT+'` lists `RecognitionBasis` and `LearningStatus` enums.
- `psql ... -c '\d algorithm_cases'` shows `search_vector tsvector` GENERATED column and the four GIN indexes (`tags`, `search_vector`, `name_trgm`, `display_name_trgm`).
- `psql ... -c "SELECT extname FROM pg_extension"` lists `pg_trgm`.
- `pnpm --filter @rubik/api typecheck` clean — Prisma client generation succeeded and the new model types compile.
- `make dev.api` boots; `curl localhost:3001/v1/readyz` returns 200.

### Tests

No new tests this sub-phase. The migration's correctness is verified by:
- `prisma migrate dev` itself (refuses to apply broken DDL).
- The verification queries above.
- `/readyz`'s existing `SELECT 1` probe.

Testcontainers integration tests land in sub-phase 6 (per the parent plan); pulling them forward would require seed fixtures and a running content layer that don't exist yet.

## Done when

- [ ] `docker-compose.yaml` maps Postgres to host port `5433`.
- [ ] `apps/api/.env.example` reflects `localhost:5433` for both `DATABASE_URL` and `DIRECT_URL`.
- [ ] `apps/api/.env` (local, gitignored) reflects `localhost:5433`.
- [ ] `apps/api/prisma/schema.prisma` matches §21.2 verbatim (8 models, 2 enums, preview features, `@@map`/`@@index`/`@@unique` per §21.4).
- [ ] `prisma/migrations/<ts>_init_schema/migration.sql` exists and is auto-generated DDL.
- [ ] `prisma/migrations/<ts>_add_fts/migration.sql` exists and matches the corrected §21.3 SQL above (with `immutable_array_to_string` wrapper and quoted camelCase column refs).
- [ ] `make services.up && make db.migrate` runs both migrations clean from a fresh volume.
- [ ] `psql` shows 8 tables, 2 enums, `pg_trgm` extension, `search_vector` generated column, four GIN indexes on `algorithm_cases`.
- [ ] `pnpm --filter @rubik/api typecheck` passes.
- [ ] `make dev.api` boots; `/v1/healthz` 200; `/v1/readyz` 200.

## Out of scope (deferred to later sub-phases / plans)

| Deferred | Where it lands |
|---|---|
| `prisma/seed.ts` implementation (YAML → DB) | Plan 06 / sub-phase 6. Needs `content/` to exist. |
| Catalog / auth / me / scramble / search modules consuming the new models | Sub-phases 3, 4, 5 of plan 05. |
| Testcontainers integration tests | Sub-phase 6. |
| `SearchService` raw-SQL queries (`ts_rank_cd`, `similarity`) | Sub-phase 5. |
| Production Neon URLs / direct vs pooled split | Plan 09 (deployment). |

## Commit plan

Three commits, each compiles + lints + typechecks on its own (per `080-process-rule.md`):

1. `chore(tooling): move compose postgres to host port 5433` — `docker-compose.yaml` + `apps/api/.env.example`. Body explains the host-port collision.
2. `feat(prisma): add catalog + auth schema (plan 05 sub-phase 2)` — `schema.prisma` + the auto-generated `init_schema` migration directory. Body cites §21.2.
3. `feat(prisma): add fts + trigram indexes (plan 05 sub-phase 2)` — only the `add_fts` migration directory. Body cites §21.3 and notes the deliberate raw-SQL choice.

## Risks

- **Schema drift detection on future migrations.** Prisma will see the `search_vector` column as "extra" if we ever run `prisma migrate diff` against an empty model. Mitigation: don't fight it; always use `prisma migrate dev --create-only` for any future raw-SQL change so the diff is hand-curated.
- **`relationJoins` preview feature behavior.** Listed in §21.2; current Prisma 6 behavior may differ from when the design was written. Mitigation: enable as specified; if it surfaces issues we drop the flag in a follow-up — preview features are by definition movable.
- **`fullTextSearchPostgres` preview vs. our raw-SQL FTS.** We're not using Prisma's `fullTextSearchPostgres` API — we're going straight to `$queryRaw` (sub-phase 5). Keeping the flag enabled is harmless and matches §21.2; revisit only if it costs us.
- **`immutable_array_to_string` persists through `prisma migrate reset`.** Reset drops + recreates all tables but does not drop the function. Re-running the `add_fts` migration succeeds because `CREATE OR REPLACE FUNCTION` is idempotent. Not a bug — just expected behavior of raw-SQL migrations whose objects live outside the schema model.
