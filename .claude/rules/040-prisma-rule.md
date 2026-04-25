# Prisma Conventions

`apps/api/prisma/schema.prisma` is the database source of truth. Concrete schema lives at §21. This file pins the conventions that govern adding/modifying it.

## Naming

- **Models singular, PascalCase.** `Puzzle`, `Method`, `AlgorithmCase`. Never `Puzzles` or `algorithm_cases` in Prisma-land.
  - Why: matches Prisma's official convention; your client API reads `prisma.puzzle.findUnique(...)`.
- **Fields camelCase.** `displayName`, `caseState`, `chosenVariantId`.
  - Why: Prisma official; client code stays JS-idiomatic.
- **Tables snake_case via `@@map`.** Every model maps to its lower_snake_case table: `@@map("algorithm_cases")`. Field `@map`s only when the column would otherwise be ambiguous.
  - Why: Postgres convention is snake_case; mixing camelCase in SQL queries (e.g., raw SQL) is friction.
- **Enums SCREAMING_SNAKE_CASE values.** `LearningStatus { LEARNING LEARNED MASTERED }`.
  - Why: Postgres enum values are case-sensitive identifiers; SCREAMING is universally readable in SQL and TS.

## IDs

- **`@id @default(cuid())` on every model unless there's a hard reason otherwise.**
  - Why: short, sortable, URL-safe, no collisions across distributed inserts. The natural choice for slug-distinct content where you also want a stable internal ID.
- **Composite primary keys via `@@id([a, b])`** when the row's identity is the relationship itself. Example: `UserAlgorithm` keyed on `(userId, caseId)` (§21.2).
  - Why: enforces one row per user-case at the DB layer; no application-side dedup logic.
- **Don't expose internal IDs in URLs.** Use slugs (`/3x3/cfop/pll/t-perm`), not cuids.
  - Why: slugs are human-readable and SEO-friendly; cuids are an internal identity, not a URL.

## Relations

- **Always set `onDelete` explicitly.** `Cascade` for ownership (Method → Sets cascade), `SetNull` for soft references (UserAlgorithm.chosenVariantId → SetNull on variant delete), no default.
  - Why: implicit `Restrict` is the Prisma default; surprises happen when a delete unexpectedly fails. Explicit is the contract.
- **Index every foreign key + a sort field.** Pattern: `@@index([methodId, displayOrder])`.
  - Why: list endpoints filter by parent and order by display index; the composite index serves both.
- **`@@unique` for compound uniqueness; `@unique` for single-field.** `@@unique([puzzleId, slug])` enforces unique slugs within a puzzle.
  - Why: Prisma generates the right Postgres index; uniqueness shows up in the type signatures of `findUnique`.

## Schema vs raw SQL

- **Use `schema.prisma` for everything Prisma can model.** Tables, columns, indexes, foreign keys, enums.
  - Why: drift-free generation of the client + migrations.
- **Drop to raw SQL only for things Prisma can't model:** Postgres extensions (`pg_trgm`), generated columns (`tsvector`), GIN indexes, partial indexes, triggers (§21.3).
  - Why: those features aren't in Prisma's DSL; pretending otherwise produces broken migrations.
- **Raw SQL goes in the same `migration.sql` file** as the auto-generated DDL. Prisma will accept it on the next `migrate dev` and replay it on `migrate deploy`.
  - Why: one ordered list of migrations; mixing manual and auto migrations in separate files is how you get duplicate-table errors.

## Migrations

- **One migration per logical change.** Renaming a column? One migration. Adding three unrelated indexes? Three migrations.
  - Why: bisectability and rollback granularity. A monolith migration that fails halfway is a nightmare.
- **Migration names are imperative + scoped:** `add_user_algorithm`, `add_fts_to_cases`, `rename_display_order_to_position` (with the rename SQL).
  - Why: `git log prisma/migrations` reads as a changelog of the schema.
- **`prisma migrate dev` for local; `prisma migrate deploy` for CI/prod.** Never `db push` against a non-throwaway DB.
  - Why: `db push` skips the migration file, leaving prod and dev divergent.
- **Run `prisma migrate deploy` before traffic flips** (one-shot Fly machine). Gated by approval for prod.
  - Why: zero-downtime requires the new schema to be live before the new code expects it; the order matters.
- **Destructive migrations need a strategy doc.** Dropping a column? Deprecate first, ship a writer that ignores it, then drop. Don't drop a column on a hot table on a Friday.
  - Why: column drops are permanent; backfills take time; rollback is harder than rollback-of-code.

## Querying

- **Use the typed client; reach for `$queryRaw` only for what the client can't do.** FTS with `ts_rank_cd`, trigram `similarity`, recursive CTEs, advanced window functions.
  - Why: typed client = autocomplete + refactor safety. `$queryRaw` is a hatch, not a habit.
- **`select` for narrow reads, `include` for relations.** Don't fetch the whole row when you need three fields; don't fetch the relation when you need its existence.
  - Why: every byte you don't fetch is a byte you don't serialize.
- **Use `findUniqueOrThrow` / `findFirstOrThrow` when absence is a domain error.** Pair with a custom exception in the service layer.
  - Why: `null`-returning patterns force every caller to check; `Throw`-variants centralize the not-found shape.
- **Transactions via `prisma.$transaction([...])`** for multi-write atomic ops. Use the interactive form (`prisma.$transaction(async tx => ...)`) for read-then-write.
  - Why: foot-guns hide in non-atomic multi-step writes; transactions are the answer.

## Prisma Client lifecycle

- **One `PrismaClient` per Node process, injected via `nestjs-prisma`'s `PrismaService`.** Never `new PrismaClient()` in a service.
  - Why: each `PrismaClient` opens its own connection pool; multiple instances in one process eat connections.
- **Don't manage migrations from Node code.** No `$executeRaw('ALTER TABLE …')` in services.
  - Why: migrations are versioned files. Code-driven schema changes can't be reviewed, replayed, or rolled back.

## Connection pooling

- **`DATABASE_URL` = pooled (Neon's pgbouncer/pooler). `DIRECT_URL` = direct (for migrations).** Prisma respects both via `datasource.directUrl`.
  - Why: pgbouncer in transaction-mode breaks prepared statements; migrations need a direct connection.
- **`?pgbouncer=true&connection_limit=1` on the pooled URL for batch jobs** (e.g., `prisma db seed`). Or run against `DIRECT_URL`.
  - Why: high-concurrency seeds saturate the pooler; serializing helps.

## Seed pipeline

- **`prisma/seed.ts` is the YAML → DB bridge** (§22.4). Idempotent upserts in dependency order: Puzzle → Method → Set → Case → Variant.
  - Why: rerunning with the same content converges; there's no "first run vs nth run" branch to maintain.
- **Validation runs before any DB write.** zod parses every YAML file; cube-core verifies notation correctness; only then upsert.
  - Why: a half-applied seed is harder to recover from than no seed at all.
- **Deletion requires `--prune`.** Without it, missing slugs are warnings, not deletions.
  - Why: an accidental rename of `t-perm.yaml` would otherwise nuke production data.

## Soft delete

- **Not used in v1.** Hard delete with cascade.
  - Why: complexity tax with no current value. When we add audit/recovery requirements, soft delete moves with them, not as a standalone feature.
