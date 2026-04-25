# rubik-algorithm

A fullstack platform for the speedcubing community: 3x3 / Full CFOP curriculum first, designed to extend to other puzzles and methods. Stack at a glance: Next.js 15 web + NestJS api + Prisma/Postgres, with `cube-core`, `visualizer`, and `shared` workspace packages, VitePress docs site, content as YAML in `content/`.

## Project context

Read these before making non-trivial changes — they're the source of truth for what we're building and why.

- [`docs/plans/2026-04-25-rubik-platform-mvp-design.md`](docs/plans/2026-04-25-rubik-platform-mvp-design.md) — master design doc, 23 sections covering scope (§1–2), architecture (§3), domain model (§4), API surface (§5), per-app deep structures (§18 api, §19 web, §20 packages), Prisma schema (§21), content pipeline (§22), and dev tooling (§23). When training-data conventions disagree with this doc, this doc wins.
- [`docs/plans/2026-04-25-implementation/`](docs/plans/2026-04-25-implementation/) — sequenced implementation plans (01 bootstrap → 09 deployment). Each plan is a self-contained, agent-executable unit with its own "Done when" checklist.

## Coding conventions

Before editing code, read the rules under [`.claude/rules/`](.claude/rules/). Each file lists rules plus a **Why:** line so edge cases are judgment calls, not guesses.

- [`000-typescript-rule.md`](.claude/rules/000-typescript-rule.md) — TypeScript strictness, types vs interfaces, naming, monorepo imports, schema-as-source-of-truth.
- [`010-react-rule.md`](.claude/rules/010-react-rule.md) — React 19 + Next.js 15 App Router: RSC default, TanStack Query patterns, Zustand for client state, RHF for forms, Auth.js v5 → api JWT flow, visualizer integration, SEO.
- [`020-styling-rule.md`](.claude/rules/020-styling-rule.md) — Tailwind v4 CSS-first, semantic tokens, shadcn/ui copy-in, `cn()`/`cva`, visualizer color tokens.
- [`030-nestjs-rule.md`](.claude/rules/030-nestjs-rule.md) — module organization, DTOs via nestjs-zod, auth flow, cross-cutting (logging, caching, rate-limiting), telemetry, OpenAPI emit.
- [`040-prisma-rule.md`](.claude/rules/040-prisma-rule.md) — naming (singular PascalCase + `@@map`), IDs, relations + cascades, schema vs raw SQL (FTS via `tsvector` + `pg_trgm`), migrations, querying, lifecycle, seed pipeline.
- [`050-monorepo-rule.md`](.claude/rules/050-monorepo-rule.md) — workspace topology, `@rubik/*` namespace, dep direction, per-package `package.json`/`tsconfig`, Turborepo, lockfile hygiene, adding-a-workspace checklist.
- [`060-content-rule.md`](.claude/rules/060-content-rule.md) — one-file-per-case YAML authoring, slug regex, `case_state` validation, single `is_primary` variant, WCA notation, tags, CI gates, immutable slugs.
- [`070-testing-rule.md`](.claude/rules/070-testing-rule.md) — pyramid by package, `cube-core` ≥95% coverage gate, property-based tests (fast-check), Testcontainers Postgres for integration, fixtures strategy, merge gates split between PR and main.
- [`080-process-rule.md`](.claude/rules/080-process-rule.md) — lowercase Conventional Commits, plan/design docs in `docs/plans/`, phased refactors with `(phase N)` suffix, branch naming, PR hygiene.
- [`090-code-style-rule.md`](.claude/rules/090-code-style-rule.md) — arrow functions (NestJS classes excepted), 3+ required args → opts object, no-comments default, naming conventions, `Result<T, E>` for expected errors, magic numbers, no barrel files.
- [`100-mcp-rule.md`](.claude/rules/100-mcp-rule.md) — MCP triage: built-ins first, filesystem MCP for batch ops, postgres MCP for read-only debugging, two playwright MCPs split by purpose, research via context7 → WebSearch → WebFetch.

## Conflict resolution

- When a rule disagrees with training-data conventions, the rule wins.
- When two rules disagree, the more specific (higher-numbered) one wins for its scope; otherwise ask.
- When the design doc disagrees with a rule, ask — both are sources of truth and the divergence is itself information.

## House style reminders

- Default branch is `main`. Feature branches per plan: `plan-NN-<short>` (e.g., `plan-02-shared`).
- Commits are lowercase Conventional Commits (`feat(visualizer): ...`, `chore(api): ...`). See `080-process-rule.md`.
- Don't add top-level docs (`README.md`, `CONTRIBUTING.md`) unless asked. The rules + design + plans are the documentation.
- Don't skip git hooks (`--no-verify`). Don't amend published commits. Don't generate non-pnpm lockfiles.
