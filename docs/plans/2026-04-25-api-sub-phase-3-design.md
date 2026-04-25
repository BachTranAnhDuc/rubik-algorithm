# Plan 05 — Sub-phase 3: Catalog endpoints

**Parent:** [`05-apps-api.md`](2026-04-25-implementation/05-apps-api.md)
**Cut:** A (by-layer sub-phasing). This is sub-phase 3 of 6.
**Depends on:** sub-phase 2 (`34a2433 feat(prisma): add fts + trigram indexes`).
**Reference:** §5 (API surface), §18.2/18.3/18.4 (NestJS structure + cross-cutting), §21 (Prisma schema).

## Problem

Sub-phase 2 landed the Prisma schema and FTS migration. Nothing yet exposes the catalog tables over HTTP. Sub-phase 3 ships the five public read-only catalog endpoints required by §5: list puzzles, list methods for a puzzle, list sets for a method, set detail (with cases + variants), case detail (with variants). These power every read on `/3x3/...` URLs in the web app and feed the search/scramble work in sub-phase 5.

## Goal

A working catalog API: five `@Public()` GET endpoints that read from Postgres, return the §5-shaped JSON, emit `Cache-Control` headers for CDN caching, and surface stable error codes on not-found. After this sub-phase, the api can serve a fully populated catalog (once seeded in plan 06) without further backend work.

## Deliverables

```
apps/api/src/modules/catalog/
├── catalog.module.ts                            aggregates submodules
├── exceptions.ts                                domain exceptions (stable codes)
├── puzzles/
│   ├── puzzles.module.ts
│   ├── puzzles.controller.ts                    GET /v1/puzzles, /v1/puzzles/:puzzle/methods
│   ├── puzzles.service.ts
│   └── __tests__/puzzles.service.spec.ts
├── methods/
│   ├── methods.module.ts
│   ├── methods.controller.ts                    GET /v1/puzzles/:puzzle/methods/:method/sets
│   ├── methods.service.ts
│   └── __tests__/methods.service.spec.ts
├── sets/
│   ├── sets.module.ts
│   ├── sets.controller.ts                       GET /v1/sets/:set
│   ├── sets.service.ts
│   └── __tests__/sets.service.spec.ts
└── cases/
    ├── cases.module.ts
    ├── cases.controller.ts                      GET /v1/cases/:case
    ├── cases.service.ts
    └── __tests__/cases.service.spec.ts

apps/api/src/common/decorators/
└── public-cacheable.decorator.ts                @PublicCacheable + @Public composite

apps/api/src/app.module.ts                       imports CatalogModule

packages/shared/src/schemas/puzzle.ts            drop 3 unused fields (drift fix)
```

No DB migrations, no `infra/*` changes. Schemas already exist in `@rubik/shared`; we wire them in via `nestjs-zod`.

## Approach

### 1. Drop the three drift fields from `@rubik/shared` (commit 1)

`packages/shared/src/schemas/puzzle.ts` currently declares three fields the §21.2 Prisma schema doesn't model:

- `AlgorithmVariant.videoUrl: z.string().url().nullable()`
- `AlgorithmSet.displayName: z.string().nullable()`
- `AlgorithmSet.descriptionMd: z.string().nullable()`

The catalog service can't produce these — there are no DB columns. Drop them from the shared schemas. The corresponding type aliases (`AlgorithmVariant`, `AlgorithmSet`) update automatically via `z.infer`. Re-run `pnpm --filter @rubik/shared test` to confirm `puzzle.spec.ts` still passes (any field-specific assertions there get pruned).

Why first: the catalog services use these schemas as DTOs. Dropping fields after wiring means double-touching the DTO code. Cleanest as a standalone refactor commit.

### 2. Domain exceptions with stable codes (commit 2)

Per §18.4, domain exceptions extend `HttpException` with stable error codes the api contract publishes. `apps/api/src/modules/catalog/exceptions.ts` defines four:

- `PuzzleNotFoundException` → HTTP 404, code `puzzle_not_found`
- `MethodNotFoundException` → 404, code `method_not_found`
- `SetNotFoundException` → 404, code `set_not_found`
- `CaseNotFoundException` → 404, code `case_not_found`

Each carries the lookup key in `details` (`{ slug }` or `{ puzzleSlug, methodSlug }`). The existing `AllExceptionsFilter` already shapes them into `{ error: { code, message, details? }, requestId }`.

Why a separate commit: stable error codes are part of the public API contract; landing them as their own commit keeps the diff bisectable and the codes greppable in history.

### 3. Module-by-module endpoint landings (commits 3–6)

Each catalog submodule lands as its own commit. Per-module shape:

- **`<resource>.module.ts`** — declares controller + service. No imports beyond `PrismaService` (global) and the catalog exceptions.
- **`<resource>.controller.ts`** — `@Controller({ path: '...', version: '1' })`, one or two `@Get(...)` handlers, `@Public()`, `@PublicCacheable()` (see §5 below). Returns the service's typed result. Uses `nestjs-zod`'s `createZodDto` to bridge `@rubik/shared` schemas into Swagger metadata.
- **`<resource>.service.ts`** — calls `PrismaService` directly. Throws domain exceptions on not-found. Each method returns the type from `@rubik/shared`.
- **`__tests__/<resource>.service.spec.ts`** — Vitest unit test with a `vi.mocked(PrismaService)` (or DI test module + mock provider). Covers: happy path returns expected shape, not-found throws the right exception with the right code.

#### 3a. Puzzles (`commit 3`)

- `GET /v1/puzzles` → `service.listPuzzles()` → `prisma.puzzle.findMany({ orderBy: { displayOrder: 'asc' } })`. Returns `Puzzle[]`.
- `GET /v1/puzzles/:puzzle/methods` → `service.listMethodsForPuzzle(slug)` → looks up puzzle by slug; if missing, throws `PuzzleNotFoundException`; otherwise returns `prisma.method.findMany({ where: { puzzleId }, orderBy: { displayOrder: 'asc' } })`. Returns `Method[]`.

The methods listing lives on the puzzles controller (not the methods module) because the URL is rooted at `/v1/puzzles/:puzzle/...`. Co-locating with the parent matches the URL semantically.

#### 3b. Methods (`commit 4`)

- `GET /v1/puzzles/:puzzle/methods/:method/sets` → `service.listSetsForMethod(puzzleSlug, methodSlug)`. Two-step lookup: puzzle by slug → method by `(puzzleId, slug)`. Throws `PuzzleNotFoundException` or `MethodNotFoundException` as appropriate. Returns `prisma.algorithmSet.findMany({ where: { methodId }, orderBy: { displayOrder: 'asc' } })`. Returns `AlgorithmSet[]`.

#### 3c. Sets (`commit 5`)

- `GET /v1/sets/:set` → `service.getSetBySlug(setSlug)`. Single-table lookup `prisma.algorithmSet.findFirst({ where: { slug }, include: { cases: { include: { variants: true } } } })`. Throws `SetNotFoundException` if missing. Returns `AlgorithmSetWithCases` (denormalized — set + nested cases + nested variants in one round-trip).

The slug is looked up globally — see §6 below for the v1 collision policy.

#### 3d. Cases (`commit 6`)

- `GET /v1/cases/:case` → `service.getCaseBySlug(caseSlug)`. `prisma.algorithmCase.findFirst({ where: { slug }, include: { variants: { orderBy: { displayOrder: 'asc' } } } })`. Throws `CaseNotFoundException` if missing. Returns `AlgorithmCaseWithVariants`.

### 4. Aggregator + app wiring (`commit 7`)

`catalog.module.ts` imports the four submodules and re-exports nothing. `app.module.ts` adds `CatalogModule` to its `imports`. This commit also lands the `@PublicCacheable()` decorator (see §5) so all four controllers can apply it from a single import.

Why the aggregator: matches §18.2's catalog parent pattern, and gives downstream code (search, me) a single import for any future cross-catalog query needs.

### 5. `Cache-Control` headers via `@PublicCacheable()`

Per §18.4, public catalog reads emit `Cache-Control: public, s-maxage=<ttl>, stale-while-revalidate=<window>`. NestJS's built-in `@CacheTTL` decorator only feeds the cache-manager interceptor (deferred to sub-phase 6). The right pattern for the header alone is a thin custom decorator that calls `@Header('Cache-Control', '...')`.

`apps/api/src/common/decorators/public-cacheable.decorator.ts`:

```ts
import { applyDecorators, Header } from '@nestjs/common'

import { Public } from './public.decorator'

const TEN_MINUTES = 600
const ONE_DAY = 86400

export const PublicCacheable = (options?: { sMaxAge?: number; staleWhileRevalidate?: number }) => {
  const sMaxAge = options?.sMaxAge ?? TEN_MINUTES
  const swr = options?.staleWhileRevalidate ?? ONE_DAY
  return applyDecorators(
    Public(),
    Header('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`),
  )
}
```

Default `s-maxage=600` matches §18.4's example. `stale-while-revalidate=86400` is added on top: lets the CDN serve a stale response for up to a day while revalidating in the background — content rarely changes but a stale-but-fast response beats a cache-miss spike. Catalog handlers stack `@Get(...)` + `@PublicCacheable()`. The decorator composes `@Public()` so a single line at each handler covers both auth opt-out and CDN headers.

Why custom: NestJS doesn't ship a "set Cache-Control to s-maxage=N" decorator out-of-the-box; we'd repeat the `@Header` string at every endpoint. One decorator, one source of truth.

### 6. Slug-collision policy for `/v1/sets/:set` and `/v1/cases/:case`

§5 routes set and case detail by single slug (`/v1/sets/:set`, not `/v1/sets/:method/:set`). The Prisma uniqueness is per-parent (`@@unique([methodId, slug])`, `@@unique([setId, slug])`), so two methods in theory could each have a set named `pll`, or two sets a case named `t-perm`.

In v1 content, this collision doesn't happen — set names (`f2l`, `oll`, `pll`) and case names (`t-perm`, `aa-perm`, …) are globally distinct by convention. The seed pipeline (plan 06) will validate uniqueness at the application layer.

For v1, the service uses `findFirst({ where: { slug }, orderBy: { displayOrder: 'asc' } })`. If a collision is ever introduced, the lower `displayOrder` wins deterministically. Document this in the route's controller comment so the next reader knows.

v2 may switch routes to `/v1/methods/:method/sets/:set` and `/v1/sets/:set/cases/:case` if collisions become real. Out of scope for this sub-phase.

### 7. Tests

Per `070-testing-rule.md`, Vitest unit tests per service. Each spec covers:

- Happy path: stub Prisma to return rows, assert the service returns the §5-shaped result.
- Not-found path: stub Prisma to return `null`/`[]`, assert the service throws the right exception with the right `code`.

No Testcontainers integration tests this sub-phase (defer to sub-phase 6). Controllers don't get dedicated unit tests — they are thin wrappers, and the service tests cover the behavior. The contract test (OpenAPI snapshot) lands with sub-phase 6.

Coverage target for `apps/api`: ≥80% soft target per `070-testing-rule.md`. No hard gate.

### 8. OpenAPI metadata

Each controller annotates its endpoints with `@ApiOkResponse` / `@ApiNotFoundResponse` from `@nestjs/swagger`, using `nestjs-zod`'s `createZodDto(...)` to bridge schemas. Swagger UI at `/v1/docs` already exposes these in non-prod from sub-phase 1. The `openapi.json` emit script lands in sub-phase 6.

## Done when

- [ ] `packages/shared/src/schemas/puzzle.ts` no longer exports `videoUrl`, `displayName`, `descriptionMd`. `pnpm --filter @rubik/shared test` passes.
- [ ] `apps/api/src/modules/catalog/exceptions.ts` exports four `*NotFoundException` classes with stable string codes.
- [ ] `apps/api/src/modules/catalog/{puzzles,methods,sets,cases}/` each has module + controller + service + service spec.
- [ ] `apps/api/src/modules/catalog/catalog.module.ts` aggregates the four submodules; `app.module.ts` imports it.
- [ ] `apps/api/src/common/decorators/public-cacheable.decorator.ts` exists and wraps `@Public()` + `@Header('Cache-Control', ...)`.
- [ ] All five endpoints (`GET /v1/puzzles`, `GET /v1/puzzles/:puzzle/methods`, `GET /v1/puzzles/:puzzle/methods/:method/sets`, `GET /v1/sets/:set`, `GET /v1/cases/:case`) respond with the §5-shaped JSON when the DB has data.
- [ ] All five endpoints emit `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400` (verifiable via `curl -I`).
- [ ] All four not-found cases return HTTP 404 with `error.code` matching `*_not_found`.
- [ ] `pnpm --filter @rubik/api typecheck` clean.
- [ ] `pnpm --filter @rubik/api test` runs all four service specs green.
- [ ] `make dev.api` boots; Swagger UI at `/v1/docs` lists the new endpoints.
- [ ] `git status --short` clean (only the pre-existing untracked items).

## Out of scope (deferred to later sub-phases / plans)

| Deferred | Where it lands |
|---|---|
| Real catalog data in the DB | Plan 06 (content seeding). For now endpoints work but return empty arrays / 404. |
| Auth + `/v1/me/*` endpoints | Sub-phase 4. |
| Scramble + search endpoints | Sub-phase 5. Search uses the FTS infra from sub-phase 2. |
| `@nestjs/cache-manager` Redis interception | Sub-phase 6. Cache-Control headers handle the CDN tier here. |
| OpenAPI emit script + `openapi.json` artifact | Sub-phase 6. |
| Testcontainers integration tests | Sub-phase 6. |
| Pagination on `/v1/puzzles/...` lists | Out of v1; add when a puzzle has >100 methods. The v1 catalog tree fits in a single page. |
| Per-resource ETag / `If-None-Match` | Out of v1. CDN's content-hash-based caching is enough. |

## Commit plan

Seven commits, each compiles + lints + typechecks on its own (per `080-process-rule.md`):

1. `refactor(shared): drop unused video/displayName/descriptionMd from catalog schemas` — `packages/shared/src/schemas/puzzle.ts`. Body explains the §21.2 alignment.
2. `feat(api): add catalog domain exceptions with stable codes` — `apps/api/src/modules/catalog/exceptions.ts`. Body lists the four codes.
3. `feat(api): add puzzles module + endpoints (plan 05 sub-phase 3)` — puzzles controller + service + spec.
4. `feat(api): add methods module + endpoint (phase 3)` — methods controller + service + spec.
5. `feat(api): add sets module + endpoint (phase 3)` — sets controller + service + spec.
6. `feat(api): add cases module + endpoint (phase 3)` — cases controller + service + spec.
7. `feat(api): aggregate catalog and add public-cacheable decorator (phase 3)` — catalog.module.ts, public-cacheable.decorator.ts, app.module.ts wiring, and applies the decorator to all controllers.

Commit 7 is the final wiring step that flips the api on. Catalog endpoints don't reach the router until then. This deliberate ordering lets each preceding commit compile (the modules exist as dead code inside their own files until the aggregator imports them) without breaking the shipped API surface mid-sequence.

## Risks

- **Slug collisions on sets/cases.** Documented above. Risk is content-discipline, not code. Seed validation (plan 06) will surface any real collision; the deterministic `displayOrder` tiebreak prevents undefined behavior in the meantime.
- **`Cache-Control` and authenticated routes interaction.** `@PublicCacheable()` is only applied to handlers that already have `@Public()`. If anyone copies the decorator onto an authenticated route by mistake, the response will be cached at the CDN with a user-visible body. Mitigation: the decorator composes `@Public()` itself, so it's only legitimate on already-public routes — the name `PublicCacheable` documents this.
- **`nestjs-zod` integration with shared schemas.** `createZodDto(SchemaFromSharedPackage)` works as long as `nestjs-zod` reads zod's metadata; preview features in sub-phase 2's schema (`fullTextSearchPostgres`, `relationJoins`) don't affect this. If the bridge is fussy, fall back to `@ApiProperty` annotations on a thin DTO class — small workaround, not a blocker.
