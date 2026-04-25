# Plan 05 sub-phase 2 — Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the §21 Prisma schema (8 models + 2 enums) plus a raw-SQL FTS migration in `apps/api`, and move the Compose Postgres off the host's `:5432` so migrations actually apply.

**Architecture:** Two migrations. The first is auto-generated DDL from `prisma migrate dev --name init_schema`. The second is hand-authored raw SQL (`pg_trgm` extension + generated `tsvector` column + GIN indexes) created via `prisma migrate dev --create-only --name add_fts`. No application code changes — `PrismaService` picks up the typed models for free.

**Tech Stack:** Prisma 6, PostgreSQL 17 (Compose), `pg_trgm` extension, `tsvector` generated column.

**Spec:** [`docs/plans/2026-04-25-api-sub-phase-2-design.md`](2026-04-25-api-sub-phase-2-design.md)
**Schema source of truth:** §21 of [`docs/plans/2026-04-25-rubik-platform-mvp-design.md`](2026-04-25-rubik-platform-mvp-design.md)

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm status --short`
Expected: branch `docs/cubing-domain-research`; status shows only the pre-existing untracked items (`.mcp.json`, `README.md`, `packages/visualizer/`).

- [ ] **Step 2: Confirm pnpm and docker compose are available**

Run: `pnpm --version && docker compose version`
Expected: both print versions, no errors.

---

## Task 1: Move Compose Postgres to host port 5433

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/.env` (gitignored, must already exist from sub-phase 1; if not, create)

- [ ] **Step 1.1: Stop any running Compose stack to release the old port mapping**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml down`
Expected: `Removing rubik-postgres … done` and `Removing rubik-redis … done`, or "no containers" if already down. No error.

- [ ] **Step 1.2: Edit `docker-compose.yaml` — change postgres port mapping**

Replace the postgres `ports:` block:

```yaml
    ports:
      - '5432:5432'
```

with:

```yaml
    ports:
      - '5433:5432'
```

Leave Redis on `6379:6379` untouched.

- [ ] **Step 1.3: Edit `apps/api/.env.example`**

Replace these two commented lines:

```
# DATABASE_URL=postgres://rubik:rubik@localhost:5432/rubik
# DIRECT_URL=postgres://rubik:rubik@localhost:5432/rubik
```

with:

```
# DATABASE_URL=postgres://rubik:rubik@localhost:5433/rubik
# DIRECT_URL=postgres://rubik:rubik@localhost:5433/rubik
```

- [ ] **Step 1.4: Edit `apps/api/.env` (gitignored local file)**

Update the `DATABASE_URL` and `DIRECT_URL` values to use port `5433`. The file should contain (uncommented):

```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://rubik:rubik@localhost:5433/rubik
DIRECT_URL=postgres://rubik:rubik@localhost:5433/rubik
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=dev-access-secret-not-for-prod-min-32-chars-long
JWT_REFRESH_SECRET=dev-refresh-secret-not-for-prod-min-32-chars-long
```

If the file does not exist (sub-phase 1 cleanup may have removed it), create it with the contents above.

- [ ] **Step 1.5: Bring Compose up with the new mapping**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml up -d postgres redis`
Expected: both containers report `Started`. No port-bind errors.

- [ ] **Step 1.6: Confirm Postgres is reachable on host port 5433**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres pg_isready -U rubik -d rubik`
Expected: `localhost:5432 - accepting connections` (this is the in-container port — confirms the daemon is up).

Run: `ss -tln | grep -E ':5433\\b'`
Expected: a line showing `LISTEN` on `0.0.0.0:5433` or `*:5433`. Confirms the host-side port mapping landed.

- [ ] **Step 1.7: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add docker-compose.yaml apps/api/.env.example
git commit -m "$(cat <<'EOF'
chore(tooling): move compose postgres to host port 5433

The host machine runs its own Postgres on 5432, so the Compose
container could not bind. Bumping the host-side mapping to 5433
isolates the dev DB from any host install. The container still
listens on 5432 internally; only the host port changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Author the §21.2 schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 2.1: Replace `apps/api/prisma/schema.prisma` with the §21.2 schema**

The new file contents:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres", "relationJoins"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ============================================================
// Catalog: Puzzle → Method → Set → Case → Variant
// ============================================================

model Puzzle {
  id                 String   @id @default(cuid())
  slug               String   @unique
  name               String
  wcaEventCode       String?
  displayOrder       Int      @default(0)
  stateSchemaVersion String   @default("v1")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  methods Method[]

  @@map("puzzles")
}

model Method {
  id            String   @id @default(cuid())
  puzzleId      String
  slug          String
  name          String
  descriptionMd String?
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  puzzle Puzzle         @relation(fields: [puzzleId], references: [id], onDelete: Cascade)
  sets   AlgorithmSet[]

  @@unique([puzzleId, slug])
  @@index([puzzleId, displayOrder])
  @@map("methods")
}

enum RecognitionBasis {
  LAST_LAYER
  F2L_SLOT
  OLL_ORIENTATION
  PLL_PERMUTATION
  CROSS
  OTHER
}

model AlgorithmSet {
  id                String           @id @default(cuid())
  methodId          String
  slug              String
  name              String
  caseCountExpected Int
  recognitionBasis  RecognitionBasis
  displayOrder      Int              @default(0)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  method Method          @relation(fields: [methodId], references: [id], onDelete: Cascade)
  cases  AlgorithmCase[]

  @@unique([methodId, slug])
  @@index([methodId, displayOrder])
  @@map("algorithm_sets")
}

model AlgorithmCase {
  id            String   @id @default(cuid())
  setId         String
  slug          String
  name          String
  displayName   String
  displayOrder  Int      @default(0)
  caseState     String
  recognitionMd String?
  tags          String[] @default([])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  set            AlgorithmSet       @relation(fields: [setId], references: [id], onDelete: Cascade)
  variants       AlgorithmVariant[]
  userAlgorithms UserAlgorithm[]

  @@unique([setId, slug])
  @@index([setId, displayOrder])
  @@index([tags], type: Gin)
  @@map("algorithm_cases")
}

model AlgorithmVariant {
  id            String   @id @default(cuid())
  caseId        String
  notation      String
  moveCountHtm  Int
  moveCountStm  Int
  isPrimary     Boolean  @default(false)
  attribution   String?
  fingertrickMd String?
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  case             AlgorithmCase   @relation(fields: [caseId], references: [id], onDelete: Cascade)
  chosenByUserAlgs UserAlgorithm[] @relation("UserAlgorithm_chosenVariant")

  @@index([caseId, displayOrder])
  @@map("algorithm_variants")
}

// ============================================================
// Users + Auth
// ============================================================

model User {
  id          String    @id @default(cuid())
  email       String    @unique
  displayName String?
  googleSub   String    @unique
  avatarUrl   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  lastLoginAt DateTime?

  algorithms    UserAlgorithm[]
  refreshTokens RefreshToken[]

  @@map("users")
}

enum LearningStatus {
  LEARNING
  LEARNED
  MASTERED
}

model UserAlgorithm {
  userId          String
  caseId          String
  chosenVariantId String?
  status          LearningStatus @default(LEARNING)
  personalNotesMd String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  case          AlgorithmCase     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  chosenVariant AlgorithmVariant? @relation("UserAlgorithm_chosenVariant", fields: [chosenVariantId], references: [id], onDelete: SetNull)

  @@id([userId, caseId])
  @@index([userId, status])
  @@map("user_algorithms")
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  userAgent String?
  ip        String?
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
  @@map("refresh_tokens")
}
```

- [ ] **Step 2.2: Format the schema (canonicalize whitespace and alignment)**

Run: `pnpm --filter @rubik/api exec prisma format`
Expected: `Formatted /home/ducbach/Documents/study/rubik-algorithm/apps/api/prisma/schema.prisma in NNms`. No errors.

- [ ] **Step 2.3: Validate the schema**

Run: `pnpm --filter @rubik/api exec prisma validate`
Expected: `The schema at … is valid 🚀`. No errors.

---

## Task 3: Generate and apply the `init_schema` migration

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp>_init_schema/migration.sql` (auto-generated)
- Create: `apps/api/prisma/migrations/migration_lock.toml` (auto-generated; first migration produces it)

- [ ] **Step 3.1: Run `prisma migrate dev` to create + apply the initial migration**

Run: `pnpm --filter @rubik/api exec prisma migrate dev --name init_schema`
Expected:
- Output mentions `Applied migration(s): YYYYMMDDHHMMSS_init_schema`.
- Output reports `Generated Prisma Client` at the end.
- Exit code 0.

If Prisma asks "Are you sure you want to create and apply this migration?" answer with `Y` (this should not appear in non-interactive shells; if it does, re-run with stdin connected to a TTY, e.g. via the user's regular terminal, and let the user trigger this step).

- [ ] **Step 3.2: Verify the migration directory exists**

Run: `ls /home/ducbach/Documents/study/rubik-algorithm/apps/api/prisma/migrations/`
Expected: a single directory like `20260425XXXXXX_init_schema` plus `migration_lock.toml`.

- [ ] **Step 3.3: Spot-check the generated DDL contains all 8 tables and both enums**

Run: `grep -E '^(CREATE TABLE|CREATE TYPE)' /home/ducbach/Documents/study/rubik-algorithm/apps/api/prisma/migrations/*_init_schema/migration.sql | sort`
Expected (8 tables + 2 enums, in some order):
```
CREATE TABLE "algorithm_cases" ...
CREATE TABLE "algorithm_sets" ...
CREATE TABLE "algorithm_variants" ...
CREATE TABLE "methods" ...
CREATE TABLE "puzzles" ...
CREATE TABLE "refresh_tokens" ...
CREATE TABLE "user_algorithms" ...
CREATE TABLE "users" ...
CREATE TYPE "LearningStatus" ...
CREATE TYPE "RecognitionBasis" ...
```

- [ ] **Step 3.4: Verify the live DB has the tables**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres psql -U rubik -d rubik -c '\dt'`
Expected: 8 rows under `Schema public` listing the same tables, plus `_prisma_migrations`. No errors.

- [ ] **Step 3.5: Verify enums exist**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres psql -U rubik -d rubik -c '\dT+'`
Expected: rows for `LearningStatus` and `RecognitionBasis` with their values listed.

- [ ] **Step 3.6: Typecheck the api against the freshly generated client**

Run: `pnpm --filter @rubik/api typecheck`
Expected: exit code 0, no diagnostics. Confirms the generated `@prisma/client` types compile against the existing infra modules.

- [ ] **Step 3.7: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "$(cat <<'EOF'
feat(prisma): add catalog + auth schema (plan 05 sub-phase 2)

Land the §21.2 schema verbatim: Puzzle → Method → AlgorithmSet →
AlgorithmCase → AlgorithmVariant for the catalog, plus User,
UserAlgorithm, RefreshToken for auth. Cascades wired per §21.9 —
catalog edges cascade, UserAlgorithm.chosenVariantId is SetNull.

Preview features fullTextSearchPostgres + relationJoins enabled per
§21.2. The search_vector column and trigram indexes land in the
follow-up add_fts migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add the FTS + trigram migration

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp>_add_fts/migration.sql` (created empty by `--create-only`, then hand-edited)

- [ ] **Step 4.1: Create an empty FTS migration scaffold**

Run: `pnpm --filter @rubik/api exec prisma migrate dev --create-only --name add_fts`
Expected:
- A new `<ts>_add_fts/` directory under `apps/api/prisma/migrations/`.
- Output: `Prisma Migrate created the following migration without applying it … add_fts`.
- The new `migration.sql` file is present but contains only an empty `-- This is an empty migration.` placeholder (because the schema is unchanged).

- [ ] **Step 4.2: Replace the empty migration with the §21.3 SQL**

Open `apps/api/prisma/migrations/<latest>_add_fts/migration.sql` and replace its entire contents with:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE algorithm_cases
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(recognition_md, '')), 'C')
  ) STORED;

CREATE INDEX algorithm_cases_search_vector_idx
  ON algorithm_cases USING GIN (search_vector);

CREATE INDEX algorithm_cases_name_trgm_idx
  ON algorithm_cases USING GIN (name gin_trgm_ops);

CREATE INDEX algorithm_cases_display_name_trgm_idx
  ON algorithm_cases USING GIN (display_name gin_trgm_ops);
```

- [ ] **Step 4.3: Apply the FTS migration**

Run: `pnpm --filter @rubik/api exec prisma migrate dev`
Expected:
- Output: `Applied migration(s): <ts>_add_fts`.
- Output: `Generated Prisma Client` (idempotent regeneration).
- No drift warning. Exit code 0.

- [ ] **Step 4.4: Verify the `pg_trgm` extension is installed**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres psql -U rubik -d rubik -c "SELECT extname FROM pg_extension ORDER BY extname"`
Expected: a list including `pg_trgm` and `plpgsql`.

- [ ] **Step 4.5: Verify the `search_vector` generated column exists**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres psql -U rubik -d rubik -c '\d algorithm_cases'`
Expected, in the column list:
- A `search_vector | tsvector` row whose generation expression mentions `to_tsvector` and `setweight`.
- In the "Indexes:" section: `algorithm_cases_search_vector_idx`, `algorithm_cases_name_trgm_idx`, `algorithm_cases_display_name_trgm_idx`, plus the auto-generated `algorithm_cases_setId_slug_key`, `algorithm_cases_setId_displayOrder_idx`, and `algorithm_cases_tags_idx`.

- [ ] **Step 4.6: Smoke-test the generated column is queryable**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres psql -U rubik -d rubik -c "SELECT search_vector FROM algorithm_cases LIMIT 1"`
Expected: `(0 rows)` and no error. Confirms the generated column compiles and is selectable.

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml exec -T postgres psql -U rubik -d rubik -c "SELECT similarity('t-perm', 't perm')"`
Expected: a numeric result (~0.4–0.6). Confirms `pg_trgm` is loaded and `similarity()` is callable — what `SearchService` will use in sub-phase 5.

- [ ] **Step 4.7: Confirm `prisma migrate status` is clean**

Run: `pnpm --filter @rubik/api exec prisma migrate status`
Expected: `Database schema is up to date!`. No "drift detected" warning.

- [ ] **Step 4.8: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/prisma/migrations
git commit -m "$(cat <<'EOF'
feat(prisma): add fts + trigram indexes (plan 05 sub-phase 2)

Hand-authored migration per §21.3: enables pg_trgm, adds a generated
tsvector column on algorithm_cases (weighted A=name+display_name,
B=tags, C=recognition_md), and creates GIN indexes for full-text and
trigram fuzzy search.

Prisma cannot model generated columns or pg_trgm natively, so this
ships as a separate raw-SQL migration kept in lockstep with §21.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Boot the api and verify `/readyz`

**Files:** none modified.

- [ ] **Step 5.1: Start the api in the background**

Run: `pnpm --filter @rubik/api dev > /tmp/rubik-api.log 2>&1 &`
Expected: process forks; PID printed.

- [ ] **Step 5.2: Wait for the api to bind port 3001**

Use the executor's wait/monitor primitive (e.g. Claude Code's Monitor tool with an `until` loop on `ss -tln | grep -q ':3001\\b'`) — the api boots in 3–8s. If running interactively, a single `sleep 8` is sufficient most of the time, then proceed to step 5.3 and rely on `curl`'s connection-refused error to signal "not ready yet" and retry.

- [ ] **Step 5.3: Hit `/v1/healthz`**

Run: `curl -sS -o /tmp/healthz.json -w '%{http_code}\\n' http://localhost:3001/v1/healthz`
Expected: prints `200`. `cat /tmp/healthz.json` should show `{"status":"ok"}`.

- [ ] **Step 5.4: Hit `/v1/readyz`**

Run: `curl -sS -o /tmp/readyz.json -w '%{http_code}\\n' http://localhost:3001/v1/readyz`
Expected: prints `200`. The body shows status `ok` for both Prisma (`SELECT 1`) and the cache-manager probe.

If either probe fails:
- Postgres failure: re-check `apps/api/.env` is using `localhost:5433` and that `docker compose ps` shows the postgres container `healthy`.
- Cache failure: re-check `REDIS_URL=redis://localhost:6379` and `docker compose ps redis` is `healthy`.

- [ ] **Step 5.5: Stop the api**

Run: `pkill -f 'node --watch --import @swc-node/register/esm-register' || true`
Expected: returns 0 even if no process was running. Verify with `ss -tln | grep ':3001' || echo 'port free'`.

---

## Task 6: Spec coverage review

- [ ] **Step 6.1: Walk the spec's "Done when" checklist and tick each item**

Open `docs/plans/2026-04-25-api-sub-phase-2-design.md`. For each box, confirm via the artifacts produced above:

- `docker-compose.yaml` maps Postgres to host port `5433` — Task 1.2 + 1.6.
- `apps/api/.env.example` reflects `localhost:5433` for both URLs — Task 1.3.
- `apps/api/.env` reflects `localhost:5433` — Task 1.4.
- `apps/api/prisma/schema.prisma` matches §21.2 verbatim — Task 2.1 + 2.3.
- `prisma/migrations/<ts>_init_schema/migration.sql` exists — Task 3.2.
- `prisma/migrations/<ts>_add_fts/migration.sql` exists and matches §21.3 — Task 4.2.
- `make services.up && make db.migrate` runs both migrations clean from a fresh volume — exercised cumulatively across Tasks 1, 3, 4. (Optional bonus: `docker compose down -v && make services.up && make db.migrate` from scratch.)
- `psql` shows 8 tables, 2 enums, `pg_trgm`, `search_vector` column, four GIN indexes — Tasks 3.4, 3.5, 4.4, 4.5.
- `pnpm --filter @rubik/api typecheck` passes — Task 3.6.
- `make dev.api` boots; `/v1/healthz` 200; `/v1/readyz` 200 — Task 5.

- [ ] **Step 6.2: Confirm no in-progress edits leaked**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm status --short`
Expected: only the pre-existing untracked items (`.mcp.json`, `README.md`, `packages/visualizer/`). No staged changes, no modified tracked files. The three sub-phase-2 commits are present in `git log`.

- [ ] **Step 6.3: Print the resulting commit summary**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline -5`
Expected: top three commits are the sub-phase-2 commits in order:
```
<sha> feat(prisma): add fts + trigram indexes (plan 05 sub-phase 2)
<sha> feat(prisma): add catalog + auth schema (plan 05 sub-phase 2)
<sha> chore(tooling): move compose postgres to host port 5433
<sha> docs(plans): add api sub-phase 2 design
<sha> feat(api): scaffold platform skeleton (plan 05 sub-phase 1)
```
