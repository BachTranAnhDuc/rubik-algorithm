# Plan 06 — Content seed pipeline + initial content

**Plan:** [`06-initial-content.md`](2026-04-25-implementation/06-initial-content.md). Combined with the deferred plan-05 sub-phase 5+ pipeline work.
**Master design refs:** §22 (content directory), §22.4 (ingest pipeline), §21.2 (Prisma schema), §060-content-rule, §040-prisma-rule.
**Predecessors:** plan 05 sub-phases 1-4 (api up + auth + me on main), plan 03 (cube-core), plan 02 (`@rubik/shared` schemas).
**Branch:** `plan-06-content-seed`.

## Problem & goal

Plan 05 stood up the api with all v1 modules but skipped the seed pipeline (plan 05 step 10 explicitly says "implement prisma/seed.ts skeleton — full content lands in Plan 06"). Today the api works against an empty database — `curl /v1/puzzles` returns `[]`, the live `PUT /v1/me/algorithms/:slug` round-trip can't be verified because there are no `Case` rows.

This sub-phase ships the seed pipeline AND the first 9 cases of authored content as one combined effort, closing both the "plan 05 sub-phase 5+ tail" and "plan 06 content authoring" in one PR. The smoke gate is `curl /v1/sets/pll` returning a real T-Perm.

## Decisions (from brainstorm)

1. **Combined sub-phase:** pipeline + content + smoke ship together. Mirrors sub-phase 4's "all the auth pieces in one PR" pattern.
2. **Test scope = unit + manual smoke.** Mirrors sub-phase 4 discipline. Testcontainers integration over the seeded DB is deferred to its own dedicated sub-phase.

## Architecture

### File layout

```
apps/api/
├── prisma/
│   ├── schema.prisma                   (existing)
│   ├── seed.ts                         CLI entry — parses --validate-only / --dry-run / --prune
│   └── seed/
│       ├── load-content.ts             walks content/, parses YAML, reports malformed paths
│       ├── validate-content.ts         zod per file + cube-core cross-check
│       ├── upsert-content.ts           Prisma upserts in dep order; variants per-case deleteMany + createMany
│       └── __tests__/
│           ├── load-content.spec.ts
│           ├── validate-content.spec.ts
│           └── upsert-content.spec.ts
├── package.json (modified)
│   - dependencies: + js-yaml
│   - devDependencies: + tsx, + @types/js-yaml
│   - "prisma": { "seed": "tsx prisma/seed.ts" }
│   - scripts: + "seed", + "content:validate"
content/
├── puzzles/3x3/
│   ├── puzzle.yaml
│   └── methods/cfop/
│       ├── method.yaml
│       └── sets/
│           ├── f2l/{set.yaml, cases/<3>.yaml}
│           ├── oll/{set.yaml, cases/<3>.yaml}
│           └── pll/{set.yaml, cases/<3>.yaml}
└── fixtures/
    └── puzzles/3x3/methods/cfop/sets/
        ├── f2l/{set.yaml, cases/<2>.yaml}
        ├── oll/{set.yaml, cases/<2>.yaml}
        └── pll/{set.yaml, cases/<2>.yaml}
```

### Dependency direction

`seed.ts` and the `seed/` modules depend on:
- `@rubik/shared` (already an api dep) — schemas
- `@rubik/cube-core` (already an api dep transitively via the future scramble module; explicit dependency required here) — `parseAlgorithm`, `applyAlgorithm`, `fromStickerString`, `toStickerString`, `stateEquals`, `SOLVED_STATE`, plus published `PLL_CANONICAL_STATES`/`OLL_CANONICAL_STATES`/`F2L_CANONICAL_STATES` for sourcing canonical case_state values

No `@rubik/visualizer` (§050 rule).

### CLI modes

`apps/api/prisma/seed.ts` is the only file Prisma calls directly (via the `prisma.seed` config). Internally it parses CLI flags and dispatches:

| Flag | Behavior | Backs Make target |
|---|---|---|
| (none) | load + validate + cross-check + upsert | `make db.seed` (= `prisma db seed`) |
| `--validate-only` | load + validate + cross-check; no DB writes | `make content.validate` |
| `--dry-run` | load + validate + cross-check + report what would change in DB; no writes | `make content.diff` |
| `--prune` | as default + delete rows whose slug isn't in YAML | not yet wired to a Make target; opt-in |

Default behavior is **never destructive without `--prune`** per §040 ("Deletion requires `--prune`. Without it, missing slugs are warnings, not deletions").

### Pipeline stages

```
content/ tree
  │
  ▼  load-content.ts
walk recursively → for each *.yaml: read + parse YAML → typed map keyed by file path
  │
  ▼  validate-content.ts
for each file:
  - schema validate against the matching @rubik/shared schema
  - if it's a case file: fromStickerString(case_state); parseAlgorithm(primary_variant.notation);
    assert stateEquals(applyAlgorithm(state, moves), SOLVED_STATE)
  - on failure: throw with file path + reason; fail fast
  │
  ▼  upsert-content.ts (skipped on --validate-only)
in dependency order: Puzzle → Method → Set → Case → Variant
upserts on the natural unique keys; variants are per-case deleteMany + createMany
  │
  ▼  if --prune:
delete rows whose slug isn't in the YAML tree (warn-only by default)
```

## Content scope + authoring

### Picks

| Set | Cases | Why these |
|---|---|---|
| PLL | T-Perm, A-Perm-a, A-Perm-b | T-Perm + A-Perm required by plan 06; all are short well-known algs |
| OLL | Sune (OLL27), Anti-Sune (OLL26), H (OLL21) | Short, well-known, recognition copy is unambiguous |
| F2L | Three "in-slot, oriented" basic cases | Simplest F2L cases; minimal recognition_md |

Total: 9 case files per plan 06's "≈9 case files".

### Per-case YAML shape

Matches `CaseContentSchema` from `@rubik/shared/schemas/content.ts`:

```yaml
slug: t-perm
name: T-Perm
display_name: T-Perm
display_order: 0
case_state: "..."         # 54 chars, sticker alphabet (whitespace permitted; normalized)
recognition_md: "..."     # markdown; minimal in v1
tags: [pll, edge-corner-3-cycle]
variants:
  - notation: "R U R' U' R' F R2 U' R' U' R U R' F'"
    is_primary: true
    attribution: null
    fingertrick_md: null
```

### Authoring `case_state`

The author's job per §060 is to write **both** notation and case_state. Validator cross-checks. Two practical sources for the bootstrap:

**Option 1 — pull from cube-core's canonical states (preferred for the 9 picks).** cube-core already ships `PLL_CANONICAL_STATES`, `OLL_CANONICAL_STATES`, `F2L_CANONICAL_STATES` keyed by standard case IDs (`PllId`, `OllId`, `F2lId`). These are pre-validated reference states. The author maps each chosen case to its canonical state via:

```sh
pnpm --filter @rubik/api tsx -e "
import { PLL_CANONICAL_STATES, toStickerString } from '@rubik/cube-core'
console.log(toStickerString(PLL_CANONICAL_STATES['T-Perm']))
"
```

(Exact key names — `'T-Perm'`, `'Aa-Perm'`, `'OLL27'`, etc. — come from cube-core's exported `PllId`/`OllId`/`F2lId` types.)

**Option 2 — compute from notation.** If a case isn't in cube-core's canonical set:

```sh
pnpm --filter @rubik/api tsx -e "
import { parseAlgorithm, applyAlgorithm, invertAlgorithm, SOLVED_STATE, toStickerString } from '@rubik/cube-core'
const moves = parseAlgorithm(\"R U R' U' R' F R2 U' R' U' R U R' F'\")
console.log(toStickerString(applyAlgorithm(SOLVED_STATE, invertAlgorithm(moves))))
"
```

Either way, validator independently confirms the relationship. Long-term tooling (`make case.compute` or `seed.ts --print-state`) is YAGNI for 9 cases.

### Fixture mirror

`content/fixtures/` duplicates 2 cases per set (6 case files total) for future api integration tests + web component tests. PLL fixtures must include T-Perm (used by tests in plans 05's deferred Testcontainers sub-phase + plan 07).

## Idempotency, errors, cross-check

### Idempotency keys

| Model | Where clause | Notes |
|---|---|---|
| Puzzle | `{ slug }` | slug is `@unique` |
| Method | `{ puzzleId_slug: { puzzleId, slug } }` | composite `@@unique([puzzleId, slug])` |
| Set | `{ methodId_slug: { methodId, slug } }` | composite |
| Case | `{ setId_slug: { setId, slug } }` | composite |
| Variant | per-case `deleteMany({ caseId }) + createMany` | no natural unique key in the schema |

Variants are fully replaced per case on every upsert. `UserAlgorithm.chosenVariantId` is `onDelete: SetNull` (§21.2), so a user's preference reverts to "no preference" if a variant disappears across re-seeds. Acceptable per §060 ("Variant changes are safe").

Two `make db.seed` runs back-to-back produce identical DB state (modulo `updatedAt` timestamps, which Prisma manages — those don't change unless content actually changed).

### Errors

Fail-fast on the first error. Format:

```
<file_path>:
  - <zod issue path>: <message>
  - notation does not solve case_state: <delta on offending sticker positions>
```

The author re-runs after each fix. Per §22.4 ("Bad content fails the seed — does not silently corrupt the DB").

### Cross-check direction

Forward: `stateEquals(applyAlgorithm(fromStickerString(case_state), parseAlgorithm(notation)), SOLVED_STATE)`.

Equivalent to §060's `applyAlgorithm(SOLVED_STATE, invertAlgorithm(notation)) === case_state` but reads more intuitively (algorithm starts at case, ends at solved). Uses cube-core's `stateEquals` rather than reference equality.

### `--prune` semantics

- Default seed: missing slugs (rows in DB whose slug isn't in YAML) become **warnings**, no rows deleted.
- `--prune`: same as default, then `deleteMany` for orphan slugs in dependency-reverse order (Variant → Case → Set → Method → Puzzle). Cascades handle FK cleanup.

## Testing

Three unit specs, one per pipeline stage. All use `Test.createTestingModule` where DI is involved (none for these — they're pure functions). Mock filesystem reads in `load-content.spec.ts` via `vi.mock('node:fs/promises')` or a small in-memory adapter. Real cube-core per §070 ("Don't mock cube-core").

### `load-content.spec.ts`

- Walks a fixture directory; returns the expected file map keyed by relative path
- Throws on malformed YAML
- Throws on a directory that doesn't exist

### `validate-content.spec.ts`

- Accepts a well-formed case file (real T-Perm fixture)
- Rejects a case where `case_state.length !== 54`
- Rejects a case with zero `is_primary` variants
- Rejects a case with two `is_primary` variants
- Rejects a case where notation doesn't solve case_state (deliberately corrupted alg)
- Schema-rejects each of: missing slug, slug with uppercase, missing `display_order`

### `upsert-content.spec.ts`

- Mocks PrismaService; asserts upsert calls happen in dep order Puzzle → Method → Set → Case → Variant
- Asserts variant create flow: `deleteMany({ caseId })` then `createMany`
- Asserts `--prune` calls `deleteMany` for orphan rows (set up: prior DB state has slugs the YAML doesn't)
- Asserts default (no `--prune`) does NOT call `deleteMany` on orphan rows

## Manual smoke checklist

Run after the pipeline + content commits land. Postgres on 5433 (Compose).

1. `make content.validate` against authored 9 cases → no errors
2. Deliberately corrupt one case's algorithm (rename a move) → `make content.validate` fails with the specific case slug + the offending sticker positions; revert
3. `make db.seed` against fresh DB (`make db.reset`) → 1 puzzle + 1 method + 3 sets + 9 cases + 9 variants. Verify via `make db.studio` or `psql`
4. `make db.seed` again → no observable change (idempotency)
5. `curl http://localhost:3001/v1/puzzles` → returns `[{ slug: "3x3", ... }]`
6. `curl http://localhost:3001/v1/puzzles/3x3/methods/cfop/sets` → returns 3 sets (f2l, oll, pll)
7. `curl http://localhost:3001/v1/sets/pll` → returns set with 3 cases including T-Perm
8. `curl http://localhost:3001/v1/cases/t-perm` → returns case with primary variant (notation matches)
9. **Closes sub-phase 4 step 11.10**: with a valid Google ID token (or a manually-issued JWT if the dev server has a stub), `curl -X PUT /v1/me/algorithms/t-perm -H "Authorization: Bearer ..." -d '{"status":"LEARNING"}'` → 200 with the upserted UserAlgorithm row

## Done when

- [ ] `apps/api/prisma/seed.ts` + `apps/api/prisma/seed/{load,validate,upsert}-content.ts` exist and unit tests pass
- [ ] `tsx`, `js-yaml`, `@types/js-yaml` added to `apps/api/package.json`; `prisma.seed` config wired
- [ ] `content/puzzles/3x3/{puzzle.yaml, methods/cfop/{method.yaml, sets/{f2l,oll,pll}/{set.yaml, cases/<3>.yaml}}}` authored — 9 case files
- [ ] `content/fixtures/puzzles/3x3/methods/cfop/sets/{f2l,oll,pll}/{set.yaml, cases/<2>.yaml}` authored — 6 case files
- [ ] `make content.validate` passes against authored content
- [ ] `make db.seed` is idempotent (running twice = identical DB state)
- [ ] `make content.validate` fails fast and clearly on a deliberately-broken alg
- [ ] Smoke checklist 1-8 verified locally; 9 deferred if no Google credential handy
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean across the api package
- [ ] Commits follow lowercase Conventional Commits with scope `prisma`, `tooling`, `content`, etc.

## Out of scope

- **Full 119-case CFOP corpus** — separate authoring backlog, content PRs over time
- **Recognition images / rich `recognition_md`** — minimal copy in v1; richer text/images in a later content pass
- **`apps/api/scripts/content-lint.ts`** — Makefile target `content.lint` exists but invokes a non-existent file. Defer to a dedicated content-tooling sub-phase. The target staying broken is acceptable (no done-when checkbox depends on it).
- **Localization** — v2 (§22.7)
- **Media assets directory** — v1 generates the cube state diagram from `case_state` only (§22.7)
- **Testcontainers integration tests** — defer to dedicated infra sub-phase. Will retroactively cover seed + auth + me.
- **`make case.compute` / `seed.ts --print-state` author helper** — YAGNI for 9 cases; revisit when authoring scales

## Forward-compat notes

- The `seed/` module split makes future authoring tools (compute-state CLI, content-diff visualization, content-lint) easy to slot in alongside the existing pipeline files.
- Variant `deleteMany + createMany` is the right pattern for v1 but means each re-seed bumps `chosenVariantId` to null for every user with a preference on a churned variant. If/when this pain becomes real, switch to per-variant upsert keyed on a content hash (`hash(notation)`) — but that requires a schema change (`AlgorithmVariant.contentHash` with `@@unique([caseId, contentHash])`).
- The `--prune` flag is opt-in for safety; CI-driven deploys can flip it on once content authoring stabilizes (ops decision, not v1).
