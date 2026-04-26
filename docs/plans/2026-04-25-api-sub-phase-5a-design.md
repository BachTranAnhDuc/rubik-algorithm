# API sub-phase 5a — scramble + search modules

**Plan:** [`05-apps-api.md`](2026-04-25-implementation/05-apps-api.md). Sub-phase 5a of plan 05's tail.
**Master design refs:** §5.1 (endpoints), §18.2 (api tree), §18.4 (cross-cutting), §22.4 (FTS via $queryRaw).
**Predecessors:** plan 05 sub-phases 1-4 + plan 06 (seed pipeline + 9 cases on main).
**Branch:** `plan-05-sub5a-scramble-search`.

## Problem & goal

Plan 05's "implement modules in order: health → auth → users → catalog/* → scramble → search → me" left two modules unbuilt. The catalog now serves real seeded data, but `/v1/scramble` and `/v1/search` return 404. This sub-phase closes the v1 endpoint inventory so plan 07 web has every route it needs, and unblocks sub-phase 5b's `openapi:emit` (which wants the full controller surface).

Goal: ship `scramble` + `search` modules over cube-core + Postgres FTS. Smoke gate: `curl /v1/search?q=t-perm` returns the seeded T-Perm with full parent-slug context; `curl /v1/scramble/case/t-perm?seed=abc` returns a deterministic scramble that lands on the T-Perm state.

## Decisions (from brainstorm)

1. **Sub-phase 5 decomposed three ways** — 5a (features = scramble + search), 5b (Swagger UI + openapi:emit), 5c (Testcontainers + Dockerfile). This doc covers 5a only.
2. **Search behavior on no-FTS-hits = trigram fallback.** Run FTS first; if 0 hits, run trigram similarity ranked. Two SQL paths but typo-tolerance ("tperm" → T-Perm) and predictable rank ordering.
3. **Cases-only search hits** — matches `SearchHitSchema` exactly. Multi-entity search is forward-compat.
4. **`matchHighlight` returns null in v1** — defer `ts_headline` until the UI consumes it.
5. **`:case` path param is the slug.** Service resolves slug → caseState. Schema's `caseId` field name is internal; URL uses slug.
6. **Seed → RNG via `mulberry32(fnv1a32(seed))`.** Any string seed maps to a uint32 deterministically; cube-core's `mulberry32` is the seedable PRNG.
7. **Both endpoints `@Public()` only — NOT `@PublicCacheable()`.** Dynamic responses; no `Cache-Control`.

## Architecture

### Module layout

```
apps/api/src/modules/
├── scramble/
│   ├── scramble.module.ts
│   ├── scramble.controller.ts            GET /v1/scramble, /v1/scramble/case/:caseSlug
│   ├── scramble.service.ts               wraps cube-core wcaScramble + scrambleIntoCase
│   ├── dto/{scramble-query.dto.ts, case-scramble-query.dto.ts}
│   └── __tests__/scramble.service.spec.ts
└── search/
    ├── search.module.ts
    ├── search.controller.ts              GET /v1/search
    ├── search.service.ts                 $queryRaw FTS + trigram fallback
    ├── dto/search-query.dto.ts
    └── __tests__/search.service.spec.ts
```

Both wired into `app.module.ts` `imports`. Both inject `PrismaService` directly (no repository layer per §18.3 "trivial CRUD calls Prisma directly from the service").

### Dependency direction

- `ScrambleModule` → `@rubik/cube-core` (wcaScramble, scrambleIntoCase, mulberry32, defaultRandom, fromStickerString, formatAlgorithm) + `PrismaService` (case lookup).
- `SearchModule` → `PrismaService` only ($queryRaw).
- `CaseNotFoundException` reused from `apps/api/src/modules/catalog/exceptions.ts` — no duplicate.

No circular module imports. `infra/*` continues to inject anywhere via `@Global()`.

## Data flow

**Key cube-core API shape (from source-read):**
- `wcaScramble(opts: { length?, seed?: number, rng?: Random } = {}): Algorithm` — 3x3 only (no puzzle param), seedable via numeric seed OR injected `rng`. Returns `Move[]`.
- `scrambleIntoCase(solvingAlg: Algorithm | string): Algorithm` — purely deterministic inverse of the solving alg. **No RNG, no seed.** Takes the solving notation, not the caseState.
- `formatAlgorithm(moves): string` — canonical WCA notation string.

So our two endpoints are different shapes:
- `/v1/scramble` is the random-scramble endpoint (seedable for replay).
- `/v1/scramble/case/:slug` is the deterministic-inverse endpoint (no seed; same case → same scramble).

### `GET /v1/scramble?puzzle=3x3&seed=optional`

```
client → ?puzzle=3x3&seed=hello
  → ScrambleController.scramble(query)
  → ZodValidationPipe with ScrambleQuerySchema → { puzzle: '3x3', seed? }
  → ScrambleService.randomScramble({ puzzle, seed })
       ↳ if puzzle !== '3x3': UnsupportedPuzzleException (forward-compat; PUZZLE_SLUGS only has '3x3')
       ↳ numericSeed = seed ? fnv1a32(seed) : undefined
       ↳ moves = wcaScramble({ seed: numericSeed })
       ↳ scramble = formatAlgorithm(moves)
       ↳ returns { puzzle, scramble, seed: seed ?? null }
```

`fnv1a32(s: string): number` — small pure helper inlined in `scramble.service.ts`. FNV-1a 32-bit hash so any UTF-8 string maps to a stable uint32 for cube-core's numeric `seed` slot. One-line `// Why:` comment explains.

### `GET /v1/scramble/case/:caseSlug` (no seed; deterministic)

```
client → /v1/scramble/case/t-perm
  → ScrambleController.scrambleCase(caseSlug)
  → ScrambleService.scrambleForCase(caseSlug)
       ↳ row = prisma.algorithmCase.findFirst({
            where: { slug: caseSlug },
            select: {
              variants: {
                where: { isPrimary: true },
                select: { notation: true },
                take: 1
              },
              set: { select: { method: { select: { puzzle: { select: { slug: true } } } } } }
            }
          })
       ↳ null → CaseNotFoundException(caseSlug)
       ↳ row.variants empty → UnreachableException (schema enforces exactly one is_primary; defense-in-depth)
       ↳ moves = scrambleIntoCase(row.variants[0].notation)
       ↳ scramble = formatAlgorithm(moves)
       ↳ returns { puzzle: row.set.method.puzzle.slug, scramble, seed: null }
```

Drop `CaseScrambleQuerySchema.seed` from the controller path — cube-core's `scrambleIntoCase` is deterministic by construction; a `seed` query param would be misleading. The shared schema declares it but we ignore it for this endpoint. (If product later wants AUF-randomized case scrambles, that's a v2 affordance — `scrambleIntoCase` would take a `Random` opt and apply a U-pre-rotation.)

### `GET /v1/search?q=t-perm&limit=20`

```
client → ?q=t-perm&limit=20
  → SearchController.search(query)
  → ZodValidationPipe with SearchQuerySchema → { q, limit }
  → SearchService.search(q, limit)
       ↳ Phase 1 (FTS):
            $queryRaw(Prisma.sql`
              SELECT
                c.id AS "caseId",
                c.slug AS "caseSlug",
                c.name AS "caseName",
                s.slug AS "setSlug",
                m.slug AS "methodSlug",
                p.slug AS "puzzleSlug",
                ts_rank_cd(c.search_vector, q.tsquery) AS rank
              FROM algorithm_cases c
              JOIN algorithm_sets s ON c."setId" = s.id
              JOIN methods m ON s."methodId" = m.id
              JOIN puzzles p ON m."puzzleId" = p.id,
              plainto_tsquery('english', ${q}) AS q(tsquery)
              WHERE c.search_vector @@ q.tsquery
              ORDER BY rank DESC, c."displayOrder" ASC
              LIMIT ${limit}
            `)
       ↳ if rows.length > 0:
            return { query: q, hits: rows.map(r => ({ ...r, matchHighlight: null })) }
       ↳ Phase 2 (trigram fallback):
            $queryRaw(Prisma.sql`
              SELECT
                c.id AS "caseId",
                c.slug AS "caseSlug",
                c.name AS "caseName",
                s.slug AS "setSlug",
                m.slug AS "methodSlug",
                p.slug AS "puzzleSlug",
                similarity(coalesce(c.name, '') || ' ' || coalesce(c."displayName", ''), ${q}) AS rank
              FROM algorithm_cases c
              JOIN algorithm_sets s ON c."setId" = s.id
              JOIN methods m ON s."methodId" = m.id
              JOIN puzzles p ON m."puzzleId" = p.id
              WHERE c.name % ${q} OR c."displayName" % ${q}
              ORDER BY rank DESC, c."displayOrder" ASC
              LIMIT ${limit}
            `)
       ↳ returns { query: q, hits: [...with matchHighlight: null] }
```

### Postgres specifics

- **`plainto_tsquery`** (not `to_tsquery`) — handles user input safely. Won't throw on stray operators; turns "t-perm" into the same query "t & perm" without parser errors.
- **`@@` operator** uses the `algorithm_cases_search_vector_idx` GIN index from sub-phase 2.
- **`%` operator** uses the trigram GIN indexes (`algorithm_cases_name_trgm_idx`, `algorithm_cases_display_name_trgm_idx`) from sub-phase 2 (`migrations/20260425162309_add_fts/migration.sql`).
- **`Prisma.sql` template tags** parameterize safely — no string concatenation, no injection.
- **`ts_rank_cd` returns float; `similarity` returns float.** Both fit `SearchHitSchema.rank: z.number()`.

## Errors

All exceptions extend `HttpException` with stable codes per §030 + §090.

| Exception | Status | Code | Where thrown |
|---|---|---|---|
| `CaseNotFoundException` (reused) | 404 | `case_not_found` | scramble/case/:slug with unknown slug |
| (none for search) | — | — | empty FTS + empty trigram → `{ hits: [] }`, not 404 |
| `ZodValidationPipe` → 422 | 422 | `validation_error` | malformed `q`, `limit`, `puzzle`, `seed` |

`AllExceptionsFilter` already handles all of these.

## Configuration

No new env vars. `@rubik/cube-core` and `nestjs-zod` are already api dependencies. `Prisma.sql` ships with `@prisma/client`.

## Security

- **Search input goes through `plainto_tsquery`** which sanitizes operators — no SQL-via-tsquery injection vector.
- **Trigram operators (`%`)** receive the raw query via `Prisma.sql` parameterization — no injection.
- **No PII or auth-protected data** is exposed by these endpoints. Public reads.

## Testing

Per sub-phase 4 + plan 06 discipline: unit + manual smoke. Testcontainers integration deferred to sub-phase 5c.

### Unit tests

**`scramble.service.spec.ts`** — Real cube-core (per §070). Mocked PrismaService:
- `randomScramble({ puzzle: '3x3' })` returns a non-empty scramble string of formatted moves.
- Same seed string → identical scramble (determinism via fnv1a32 → mulberry32).
- Different seed strings → different scrambles.
- `scrambleForCase('t-perm')` calls `prisma.algorithmCase.findFirst` with the right nested select; uses the primary variant's `notation`; calls `scrambleIntoCase(notation)` (real cube-core) and `formatAlgorithm` to produce the wire string.
- `scrambleForCase('unknown')` throws `CaseNotFoundException`.
- `fnv1a32('hello')` produces a stable uint32 (sanity).
- `scrambleForCase` returns the inverse of T-Perm's notation when given t-perm — verifiable property (apply the returned scramble to SOLVED_STATE → equals the case's state).

**`search.service.spec.ts`** — Mocked `prisma.$queryRaw` (no real DB; that's 5c's domain):
- FTS phase returns rows → service returns hits with `matchHighlight: null`, rank descending.
- FTS phase returns empty → trigram phase runs → service returns trigram hits.
- Both phases empty → `{ query, hits: [] }`.
- The two `$queryRaw` calls are issued with the right parameter shape (assert via mock call args).

### Manual smoke (post-merge)

The api must be running with seeded data. Run from the repo root:

```bash
# Random scramble
curl -s 'http://localhost:3001/v1/scramble?puzzle=3x3' | jq .
# → { puzzle: '3x3', scramble: 'R U L'-ish-25-moves', seed: null }

# Deterministic scramble (same seed → same output)
curl -s 'http://localhost:3001/v1/scramble?puzzle=3x3&seed=abc' | jq .
curl -s 'http://localhost:3001/v1/scramble?puzzle=3x3&seed=abc' | jq .
# → identical scramble strings

# Case scramble
curl -s 'http://localhost:3001/v1/scramble/case/t-perm' | jq .
# → { puzzle: '3x3', scramble: '...moves that yield T-Perm state', seed: null }

# Case scramble unknown slug
curl -s -i 'http://localhost:3001/v1/scramble/case/unknown' | head -3
# → HTTP/1.1 404 Not Found
# body: { error: { code: 'case_not_found', ... }, requestId: ... }

# FTS hit
curl -s 'http://localhost:3001/v1/search?q=t-perm' | jq .
# → { query: 't-perm', hits: [{ caseSlug: 't-perm', ..., rank: 0.0X }, ...] }

# Trigram fallback (typo)
curl -s 'http://localhost:3001/v1/search?q=tperm' | jq .
# → { query: 'tperm', hits: [{ caseSlug: 't-perm', ... }, ...] }

# Empty
curl -s 'http://localhost:3001/v1/search?q=zzzzz' | jq .
# → { query: 'zzzzz', hits: [] }

# Validation
curl -s -i 'http://localhost:3001/v1/search?q=' | head -3
# → HTTP/1.1 422; body has code: validation_error
```

## Done when

- [ ] `apps/api/src/modules/{scramble,search}/` exist and unit tests pass
- [ ] Both modules wired in `app.module.ts`
- [ ] `ScrambleQuerySchema`, `CaseScrambleQuerySchema`, `SearchQuerySchema` lifted into `createZodDto` classes
- [ ] `fnv1a32` helper documented (one-liner comment for why this hash)
- [ ] FTS query uses `plainto_tsquery` + `@@` against `c.search_vector`
- [ ] Trigram fallback uses `%` operator (not raw `similarity > threshold`)
- [ ] `Prisma.sql` template tags throughout — no string concatenation
- [ ] All unit specs green; full api suite still green; typecheck + lint clean
- [ ] Manual smoke checklist verified on real seeded DB
- [ ] Commits follow lowercase Conventional Commits with scope `scramble` / `search` / `api`

## Out of scope

- **Multi-entity search** (puzzles, methods, sets) — `SearchHitSchema` is cases-only by design
- **`ts_headline` highlights** — `matchHighlight` returns null in v1
- **Search facets / filters** (by set, tag) — defer until UI exists
- **Scramble length customization** — cube-core's `wcaScramble` uses an internal default; v1 doesn't expose
- **Non-3x3 puzzles** — `PUZZLE_SLUGS = ['3x3']` in shared; multi-puzzle is plan-level scope
- **Throttler activation on /search** — `ThrottlerGuard` not yet `APP_GUARD`-wired (forward-compat from sub-phase 4); sub-phase 5c can revisit
- **Caching popular search queries** — premature; defer until traffic justifies
- **Search result pagination beyond `limit`** — no `cursor` in schema; revisit when corpus grows past 100s of cases per query

## Forward-compat notes

- `searchHit.matchHighlight: string | null` is shape-stable for adding `ts_headline` later without DTO churn.
- `scrambleForCase` returns the puzzle slug from the case's parent chain — when v2 adds non-3x3 puzzles, no API change needed.
- Trigram fallback emits the `similarity` score in the same `rank` field as FTS's `ts_rank_cd`. The two scores are not directly comparable but rank-within-phase is what matters for the UI.
