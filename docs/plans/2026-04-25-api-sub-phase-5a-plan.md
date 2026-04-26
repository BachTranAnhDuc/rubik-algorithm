# Plan 05 sub-phase 5a — Implementation plan (scramble + search)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `scramble` + `search` modules so `curl /v1/scramble`, `/v1/scramble/case/t-perm`, and `/v1/search?q=t-perm` all return real responses against the seeded DB.

**Architecture:** Two NestJS modules under `apps/api/src/modules/`. `ScrambleModule` wraps cube-core (`wcaScramble` for the random endpoint, `scrambleIntoCase(invertAlgorithm)` for the case-targeted endpoint). `SearchModule` runs `$queryRaw` against Postgres FTS (`@@` on the `search_vector` column from sub-phase 2) with a trigram fallback (`%` operator on name + displayName). Both controllers `@Public()` only — dynamic responses, no Cache-Control. DTOs lift `@rubik/shared` schemas via `nestjs-zod`.

**Tech Stack:** NestJS 11, Prisma 6 (`$queryRaw` with `Prisma.sql`), `@rubik/cube-core` (`wcaScramble`, `scrambleIntoCase`, `formatAlgorithm`, `applyAlgorithm`, `fromStickerString`, `SOLVED_STATE`), `@rubik/shared` zod schemas via `nestjs-zod`, Vitest + `unplugin-swc` for decorator metadata.

**Spec:** [`docs/plans/2026-04-25-api-sub-phase-5a-design.md`](2026-04-25-api-sub-phase-5a-design.md) (commit `3a77628`)

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline -3`

Expected: branch `plan-05-sub5a-scramble-search`; latest commit is `3a77628 docs(plans): add api sub-phase 5a design (scramble + search)`.

- [ ] **Step 2: Confirm Compose Postgres + Redis are up + DB has seeded content**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml ps`

Expected: postgres on 5433 + redis healthy.

- [ ] **Step 3: Confirm api unit tests are green at HEAD**

Run: `pnpm --filter @rubik/api test`

Expected: 62 tests pass (state from plan 06 closure).

---

## Task 1: ScrambleService + unit tests

**Files:**
- Create: `apps/api/src/modules/scramble/scramble.service.ts`
- Create: `apps/api/src/modules/scramble/__tests__/scramble.service.spec.ts`

`ScrambleService` exposes two methods: `randomScramble({ puzzle, seed? })` (wraps cube-core's `wcaScramble`) and `scrambleForCase(slug)` (looks up the primary variant's notation and returns `invertAlgorithm` of it via `scrambleIntoCase`). `fnv1a32` is a small inline helper for deterministic string-to-uint32 seeding.

- [ ] **Step 1.1: Write the failing service spec**

Create `apps/api/src/modules/scramble/__tests__/scramble.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { applyAlgorithm, fromStickerString, parseAlgorithm, SOLVED_STATE, stateEquals } from '@rubik/cube-core'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseNotFoundException } from '../../catalog/exceptions'
import { ScrambleService } from '../scramble.service'

const TPERM_NOTATION = "R U R' U' R' F R2 U' R' U' R U R' F'"
const TPERM_STATE = 'UUUUUUUUUFFRFFFFFFBLFRRRRRRDDDDDDDDDLRLLLLLLLRBBBBBBBB'

const buildPrismaMock = () => ({
  algorithmCase: {
    findFirst: vi.fn(),
  },
})

const compileService = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [ScrambleService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(ScrambleService)
}

describe('ScrambleService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('randomScramble', () => {
    it('returns a non-empty scramble string for 3x3', async () => {
      const service = await compileService(prisma)
      const result = await service.randomScramble({ puzzle: '3x3' })

      expect(result.puzzle).toBe('3x3')
      expect(result.scramble).toMatch(/^[URLDFB][2']?(\s+[URLDFB][2']?)+$/)
      expect(result.seed).toBeNull()
    })

    it('produces identical scrambles for the same seed string', async () => {
      const service = await compileService(prisma)
      const a = await service.randomScramble({ puzzle: '3x3', seed: 'hello' })
      const b = await service.randomScramble({ puzzle: '3x3', seed: 'hello' })

      expect(a.scramble).toBe(b.scramble)
      expect(a.seed).toBe('hello')
    })

    it('produces different scrambles for different seeds', async () => {
      const service = await compileService(prisma)
      const a = await service.randomScramble({ puzzle: '3x3', seed: 'hello' })
      const b = await service.randomScramble({ puzzle: '3x3', seed: 'world' })

      expect(a.scramble).not.toBe(b.scramble)
    })
  })

  describe('scrambleForCase', () => {
    it('returns the inverse of the primary variant notation', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({
        variants: [{ notation: TPERM_NOTATION }],
        set: { method: { puzzle: { slug: '3x3' } } },
      })
      const service = await compileService(prisma)

      const result = await service.scrambleForCase('t-perm')

      expect(result.puzzle).toBe('3x3')
      expect(result.seed).toBeNull()
      expect(result.scramble).toMatch(/[URLDFB]/)

      const finalState = applyAlgorithm(SOLVED_STATE, parseAlgorithm(result.scramble))
      expect(stateEquals(finalState, fromStickerString(TPERM_STATE))).toBe(true)
    })

    it('throws CaseNotFoundException when slug does not resolve', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileService(prisma)

      await expect(service.scrambleForCase('unknown')).rejects.toBeInstanceOf(CaseNotFoundException)
    })

    it('queries on the slug with the right nested select', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({
        variants: [{ notation: TPERM_NOTATION }],
        set: { method: { puzzle: { slug: '3x3' } } },
      })
      const service = await compileService(prisma)

      await service.scrambleForCase('t-perm')

      expect(prisma.algorithmCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 't-perm' },
          select: expect.objectContaining({
            variants: expect.objectContaining({
              where: { isPrimary: true },
              take: 1,
            }),
          }),
        }),
      )
    })
  })
})
```

- [ ] **Step 1.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/scramble`

Expected: FAIL with "Cannot find module '../scramble.service'".

- [ ] **Step 1.3: Create `apps/api/src/modules/scramble/scramble.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import {
  formatAlgorithm,
  scrambleIntoCase,
  wcaScramble,
} from '@rubik/cube-core'
import type { ScrambleResult } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { CaseNotFoundException } from '../catalog/exceptions'

interface RandomScrambleInput {
  puzzle: '3x3'
  seed?: string
}

// FNV-1a 32-bit hash. Maps any UTF-8 string to a stable uint32 so user-supplied
// seed strings can drive cube-core's numeric mulberry32 PRNG seed slot. Pure;
// no allocations beyond the 4-byte accumulator.
const fnv1a32 = (s: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

@Injectable()
export class ScrambleService {
  constructor(private readonly prisma: PrismaService) {}

  randomScramble(input: RandomScrambleInput): ScrambleResult {
    const numericSeed = input.seed !== undefined ? fnv1a32(input.seed) : undefined
    const moves =
      numericSeed !== undefined
        ? wcaScramble({ seed: numericSeed })
        : wcaScramble()
    return {
      puzzle: input.puzzle,
      scramble: formatAlgorithm(moves),
      seed: input.seed ?? null,
    }
  }

  async scrambleForCase(caseSlug: string): Promise<ScrambleResult> {
    const row = await this.prisma.algorithmCase.findFirst({
      where: { slug: caseSlug },
      select: {
        variants: {
          where: { isPrimary: true },
          select: { notation: true },
          take: 1,
        },
        set: {
          select: {
            method: {
              select: { puzzle: { select: { slug: true } } },
            },
          },
        },
      },
    })
    if (!row) throw new CaseNotFoundException(caseSlug)

    const primary = row.variants[0]
    if (!primary) {
      throw new Error(`case ${caseSlug} has no is_primary variant (schema invariant violated)`)
    }

    const moves = scrambleIntoCase(primary.notation)
    return {
      puzzle: row.set.method.puzzle.slug as '3x3',
      scramble: formatAlgorithm(moves),
      seed: null,
    }
  }
}
```

- [ ] **Step 1.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/scramble`

Expected: PASS — 6 tests.

- [ ] **Step 1.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 1.6: Commit**

```bash
git add apps/api/src/modules/scramble/
git commit -m "$(cat <<'EOF'
feat(scramble): add scramble service for random + case-targeted scrambles

randomScramble wraps cube-core's wcaScramble (seedable via fnv1a32 of
the user's string seed → uint32 → mulberry32). scrambleForCase looks
up the primary variant's notation and returns its inverse via
scrambleIntoCase — purely deterministic, no seed needed. Throws
CaseNotFoundException on unknown slug (reused from catalog/exceptions).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: ScrambleController + DTOs + ScrambleModule

**Files:**
- Create: `apps/api/src/modules/scramble/dto/scramble-query.dto.ts`
- Create: `apps/api/src/modules/scramble/scramble.controller.ts`
- Create: `apps/api/src/modules/scramble/scramble.module.ts`

Both endpoints `@Public()` only (dynamic; no Cache-Control). The `:caseSlug` path param resolves slug → DB row in the service.

- [ ] **Step 2.1: Create `apps/api/src/modules/scramble/dto/scramble-query.dto.ts`**

```ts
import { ScrambleQuerySchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class ScrambleQueryDto extends createZodDto(ScrambleQuerySchema) {}
```

- [ ] **Step 2.2: Create `apps/api/src/modules/scramble/scramble.controller.ts`**

```ts
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { ScrambleResult } from '@rubik/shared'

import { Public } from '../../common/decorators/public.decorator'
import { ScrambleQueryDto } from './dto/scramble-query.dto'
import { ScrambleService } from './scramble.service'

@ApiTags('scramble')
@Controller({ path: 'scramble', version: '1' })
export class ScrambleController {
  constructor(private readonly service: ScrambleService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'Random WCA-style scramble for the puzzle' })
  scramble(@Query() query: ScrambleQueryDto): ScrambleResult {
    return this.service.randomScramble(query)
  }

  @Public()
  @Get('case/:caseSlug')
  @ApiOkResponse({ description: 'Deterministic scramble that lands on the named case' })
  @ApiNotFoundResponse({ description: 'case_not_found' })
  scrambleForCase(@Param('caseSlug') caseSlug: string): Promise<ScrambleResult> {
    return this.service.scrambleForCase(caseSlug)
  }
}
```

- [ ] **Step 2.3: Create `apps/api/src/modules/scramble/scramble.module.ts`**

```ts
import { Module } from '@nestjs/common'

import { ScrambleController } from './scramble.controller'
import { ScrambleService } from './scramble.service'

@Module({
  controllers: [ScrambleController],
  providers: [ScrambleService],
})
export class ScrambleModule {}
```

- [ ] **Step 2.4: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 2.5: All scramble specs still green**

Run: `pnpm --filter @rubik/api test src/modules/scramble`

Expected: 6 tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/src/modules/scramble/dto/ apps/api/src/modules/scramble/scramble.controller.ts apps/api/src/modules/scramble/scramble.module.ts
git commit -m "$(cat <<'EOF'
feat(scramble): add controller + module for /v1/scramble/*

GET /v1/scramble?puzzle=3x3&seed=optional and
GET /v1/scramble/case/:caseSlug — both @Public() only since responses
are dynamic and not cacheable. DTO lifts ScrambleQuerySchema via
nestjs-zod for ZodValidationPipe + future Swagger surfacing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: SearchService + unit tests

**Files:**
- Create: `apps/api/src/modules/search/search.service.ts`
- Create: `apps/api/src/modules/search/__tests__/search.service.spec.ts`

`SearchService.search(q, limit)` runs `$queryRaw` FTS first; if 0 hits, runs `$queryRaw` trigram fallback. Returns `SearchResult` with `matchHighlight: null` on every hit.

- [ ] **Step 3.1: Write the failing service spec**

Create `apps/api/src/modules/search/__tests__/search.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchService } from '../search.service'

const buildPrismaMock = () => ({
  $queryRaw: vi.fn(),
})

const compileService = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [SearchService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(SearchService)
}

const ftsRow = (overrides: Record<string, unknown> = {}) => ({
  caseId: 'c-1',
  caseSlug: 't-perm',
  caseName: 'T-Perm',
  setSlug: 'pll',
  methodSlug: 'cfop',
  puzzleSlug: '3x3',
  rank: 0.06,
  ...overrides,
})

describe('SearchService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  it('returns FTS hits with matchHighlight: null when FTS finds matches', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([ftsRow()])
    const service = await compileService(prisma)

    const result = await service.search('t-perm', 20)

    expect(result.query).toBe('t-perm')
    expect(result.hits).toEqual([
      {
        caseId: 'c-1',
        caseSlug: 't-perm',
        caseName: 'T-Perm',
        setSlug: 'pll',
        methodSlug: 'cfop',
        puzzleSlug: '3x3',
        rank: 0.06,
        matchHighlight: null,
      },
    ])
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('falls back to trigram when FTS returns empty', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ftsRow({ caseSlug: 't-perm', rank: 0.45 })])
    const service = await compileService(prisma)

    const result = await service.search('tperm', 20)

    expect(result.hits).toHaveLength(1)
    expect(result.hits[0]?.caseSlug).toBe('t-perm')
    expect(result.hits[0]?.rank).toBe(0.45)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('returns empty hits when both FTS and trigram find nothing', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const service = await compileService(prisma)

    const result = await service.search('zzzzz', 20)

    expect(result).toEqual({ query: 'zzzzz', hits: [] })
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('passes limit through to both query phases', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const service = await compileService(prisma)

    await service.search('zzzzz', 5)

    const firstCall = prisma.$queryRaw.mock.calls[0]
    const secondCall = prisma.$queryRaw.mock.calls[1]
    expect(JSON.stringify(firstCall)).toContain('5')
    expect(JSON.stringify(secondCall)).toContain('5')
  })
})
```

- [ ] **Step 3.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/search`

Expected: FAIL with "Cannot find module '../search.service'".

- [ ] **Step 3.3: Create `apps/api/src/modules/search/search.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { SearchHit, SearchResult } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

interface FtsRow {
  caseId: string
  caseSlug: string
  caseName: string
  setSlug: string
  methodSlug: string
  puzzleSlug: string
  rank: number
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, limit: number): Promise<SearchResult> {
    const ftsHits = await this.runFts(q, limit)
    if (ftsHits.length > 0) {
      return { query: q, hits: ftsHits }
    }
    const trigramHits = await this.runTrigram(q, limit)
    return { query: q, hits: trigramHits }
  }

  private async runFts(q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.$queryRaw<FtsRow[]>(Prisma.sql`
      SELECT
        c.id AS "caseId",
        c.slug AS "caseSlug",
        c.name AS "caseName",
        s.slug AS "setSlug",
        m.slug AS "methodSlug",
        p.slug AS "puzzleSlug",
        ts_rank_cd(c.search_vector, plainto_tsquery('english', ${q})) AS rank
      FROM algorithm_cases c
      JOIN algorithm_sets s ON c."setId" = s.id
      JOIN methods m ON s."methodId" = m.id
      JOIN puzzles p ON m."puzzleId" = p.id
      WHERE c.search_vector @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC, c."displayOrder" ASC
      LIMIT ${limit}
    `)
    return rows.map((r) => ({ ...r, matchHighlight: null }))
  }

  private async runTrigram(q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.$queryRaw<FtsRow[]>(Prisma.sql`
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
    return rows.map((r) => ({ ...r, matchHighlight: null }))
  }
}
```

- [ ] **Step 3.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/search`

Expected: PASS — 4 tests.

- [ ] **Step 3.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 3.6: Commit**

```bash
git add apps/api/src/modules/search/
git commit -m "$(cat <<'EOF'
feat(search): add search service for FTS + trigram fallback

Phase 1 runs Postgres FTS via $queryRaw against the search_vector
GIN index from sub-phase 2 (commit 34a2433), ranked by ts_rank_cd.
Phase 2 runs trigram similarity via the % operator + similarity()
on name + displayName when FTS returns no hits — gives "tperm" →
T-Perm typo tolerance per design Q2 = trigram-fallback.

matchHighlight is null in v1 (defer ts_headline until UI consumes).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SearchController + DTO + SearchModule

**Files:**
- Create: `apps/api/src/modules/search/dto/search-query.dto.ts`
- Create: `apps/api/src/modules/search/search.controller.ts`
- Create: `apps/api/src/modules/search/search.module.ts`

`@Public()` only — dynamic responses, no Cache-Control.

- [ ] **Step 4.1: Create `apps/api/src/modules/search/dto/search-query.dto.ts`**

```ts
import { SearchQuerySchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class SearchQueryDto extends createZodDto(SearchQuerySchema) {}
```

- [ ] **Step 4.2: Create `apps/api/src/modules/search/search.controller.ts`**

```ts
import { Controller, Get, Query } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { SearchResult } from '@rubik/shared'

import { Public } from '../../common/decorators/public.decorator'
import { SearchQueryDto } from './dto/search-query.dto'
import { SearchService } from './search.service'

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'FTS-then-trigram search across cases' })
  search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    return this.service.search(query.q, query.limit)
  }
}
```

- [ ] **Step 4.3: Create `apps/api/src/modules/search/search.module.ts`**

```ts
import { Module } from '@nestjs/common'

import { SearchController } from './search.controller'
import { SearchService } from './search.service'

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
```

- [ ] **Step 4.4: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 4.5: All search specs still green**

Run: `pnpm --filter @rubik/api test src/modules/search`

Expected: 4 tests pass.

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/modules/search/dto/ apps/api/src/modules/search/search.controller.ts apps/api/src/modules/search/search.module.ts
git commit -m "$(cat <<'EOF'
feat(search): add controller + module for /v1/search

GET /v1/search?q=...&limit=20 — @Public() only since responses are
dynamic. DTO lifts SearchQuerySchema via nestjs-zod for ZodValidationPipe
and Swagger surfacing later. Returns SearchResult per @rubik/shared.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire ScrambleModule + SearchModule in app.module.ts

**Files:**
- Modify: `apps/api/src/app.module.ts`

Add both modules to the `imports` array. Order: alphabetical within feature modules per existing convention (after `AuthModule`, `CatalogModule`, before `MeModule`). Final shape:

- [ ] **Step 5.1: Edit `apps/api/src/app.module.ts`**

Read the file first to see the current imports list. Then add:

```ts
import { ScrambleModule } from './modules/scramble/scramble.module'
import { SearchModule } from './modules/search/search.module'
```

(Place these alphabetically among the other module imports.)

In the `@Module({ imports: [...] })` array, add `ScrambleModule` and `SearchModule` after `MeModule` (or alphabetically). Final imports list (preserving existing entries):

```ts
imports: [
  ConfigModule,
  LoggerModule,
  PrismaModule,
  CacheModule,
  ThrottlerModule,
  TelemetryModule,
  HealthModule,
  AuthModule,
  CatalogModule,
  MeModule,
  ScrambleModule,
  SearchModule,
],
```

- [ ] **Step 5.2: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 5.3: Full test suite**

Run: `pnpm --filter @rubik/api test`

Expected: 62 + 6 + 4 = 72 tests pass across 17 files.

- [ ] **Step 5.4: Lint**

Run: `pnpm --filter @rubik/api lint`

Expected: clean.

- [ ] **Step 5.5: Boot smoke**

```bash
pnpm --filter @rubik/api dev > /tmp/api-5a.log 2>&1 &
DEV_PID=$!
sleep 10

echo "=== /v1/scramble ==="
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3001/v1/scramble?puzzle=3x3'

echo "=== /v1/scramble/case/t-perm ==="
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3001/v1/scramble/case/t-perm'

echo "=== /v1/scramble/case/unknown (expect 404) ==="
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3001/v1/scramble/case/unknown'

echo "=== /v1/search?q=t-perm ==="
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3001/v1/search?q=t-perm'

echo "=== /v1/search empty q (expect 422) ==="
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3001/v1/search?q='

kill $DEV_PID 2>/dev/null || true
wait 2>/dev/null || true
```

Expected: 200, 200, 404, 200, 422.

- [ ] **Step 5.6: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): wire scramble + search modules in app.module

Adds ScrambleModule and SearchModule to the imports list so
/v1/scramble, /v1/scramble/case/:slug, and /v1/search are served
end-to-end. JwtAuthGuard remains APP_GUARD; both controllers
@Public() so they bypass auth without caching.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual smoke verification

This task does not produce a commit. It validates the end-to-end behavior on real seeded data per the design's smoke checklist.

- [ ] **Step 6.1: Boot api against seeded Compose Postgres**

Run: `pnpm --filter @rubik/api dev > /tmp/api-smoke.log 2>&1 &`. Wait 10s.

- [ ] **Step 6.2: Random scramble, no seed**

Run: `curl -s 'http://localhost:3001/v1/scramble?puzzle=3x3' | jq .`

Expected: body shape `{ "puzzle": "3x3", "scramble": "<25 face turns>", "seed": null }`. The `scramble` is 25 moves separated by spaces, each move from `{U,D,F,B,R,L}` optionally followed by `'` or `2`.

- [ ] **Step 6.3: Deterministic scramble, repeated seed**

```bash
A=$(curl -s 'http://localhost:3001/v1/scramble?puzzle=3x3&seed=abc' | jq -r .scramble)
B=$(curl -s 'http://localhost:3001/v1/scramble?puzzle=3x3&seed=abc' | jq -r .scramble)
[ "$A" = "$B" ] && echo "DETERMINISTIC OK: $A" || echo "FAIL: $A vs $B"
```

Expected: `DETERMINISTIC OK: <scramble>`.

- [ ] **Step 6.4: Case scramble (T-Perm)**

```bash
curl -s 'http://localhost:3001/v1/scramble/case/t-perm' | jq .
```

Expected: `{ "puzzle": "3x3", "scramble": "F R U' R' U' R U R' F' R U R' U' R' F R F'", "seed": null }` (the inverse of T-Perm's notation, formatted). The exact moves come from `formatAlgorithm(invertAlgorithm(parseAlgorithm("R U R' U' R' F R2 U' R' U' R U R' F'")))`.

Sanity: applying this scramble to a solved cube yields the T-Perm state. You can verify with cube-core:
```bash
SCRAMBLE=$(curl -s 'http://localhost:3001/v1/scramble/case/t-perm' | jq -r .scramble)
pnpm --filter @rubik/api exec tsx -e "
import { applyAlgorithm, fromStickerString, parseAlgorithm, SOLVED_STATE, stateEquals, toStickerString } from '@rubik/cube-core'
const reached = applyAlgorithm(SOLVED_STATE, parseAlgorithm('$SCRAMBLE'))
const expected = 'UUUUUUUUUFFRFFFFFFBLFRRRRRRDDDDDDDDDLRLLLLLLLRBBBBBBBB'
console.log(stateEquals(reached, fromStickerString(expected)) ? 'OK' : 'MISMATCH')
"
```

Expected: `OK`.

- [ ] **Step 6.5: Case scramble unknown slug**

```bash
curl -s -i 'http://localhost:3001/v1/scramble/case/unknown' | head -5
```

Expected: `HTTP/1.1 404`; body `{"error":{"code":"case_not_found","message":"...","details":{"slug":"unknown"}}, "requestId": ...}`.

- [ ] **Step 6.6: FTS hit**

```bash
curl -s 'http://localhost:3001/v1/search?q=t-perm' | jq .
```

Expected: body `{ "query": "t-perm", "hits": [{ "caseSlug": "t-perm", "caseName": "T-Perm", "setSlug": "pll", "methodSlug": "cfop", "puzzleSlug": "3x3", "rank": <float>, "matchHighlight": null }, ...] }`. Other PLL/OLL/F2L cases with "perm" in name/tags may also appear.

- [ ] **Step 6.7: FTS empty + trigram fallback**

```bash
curl -s 'http://localhost:3001/v1/search?q=tperm' | jq .
```

Expected: `hits` array with `t-perm` near the top (trigram similarity match on "T-Perm"). If the array is empty, the trigram threshold default (0.3) might be too strict — flag and investigate (probably needs `SET pg_trgm.similarity_threshold = 0.1` or a `similarity > 0.1` filter).

- [ ] **Step 6.8: No hits anywhere**

```bash
curl -s 'http://localhost:3001/v1/search?q=zzzzz' | jq .
```

Expected: `{ "query": "zzzzz", "hits": [] }`.

- [ ] **Step 6.9: Empty q (validation 422)**

```bash
curl -s -i 'http://localhost:3001/v1/search?q=' | head -5
```

Expected: `HTTP/1.1 422`; body `{"error":{"code":"validation_error", "details":[...]}}`.

- [ ] **Step 6.10: Stop dev server**

Run: `pkill -f "rubik/api"`. Confirm via `pgrep -f "rubik/api" || echo stopped`.

If any step fails: do not close the sub-phase. Open a follow-up commit with the fix.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

Run: `git log --oneline 3a77628..HEAD`

Expected (newest first):
```
<hash> feat(api): wire scramble + search modules in app.module
<hash> feat(search): add controller + module for /v1/search
<hash> feat(search): add search service for FTS + trigram fallback
<hash> feat(scramble): add controller + module for /v1/scramble/*
<hash> feat(scramble): add scramble service for random + case-targeted scrambles
```

- [ ] **Step F.2: Confirm full quality gates**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api lint && pnpm --filter @rubik/api test`

Expected: all green; 72 tests pass.

- [ ] **Step F.3: Done-when checklist (paste into PR description)**

```
- [x] apps/api/src/modules/{scramble,search}/ exist; unit tests pass (6 + 4 = 10 new)
- [x] Both modules wired in app.module.ts
- [x] ScrambleQuerySchema + SearchQuerySchema lifted into createZodDto classes
- [x] fnv1a32 helper inline-documented (one-line // Why comment)
- [x] FTS query uses plainto_tsquery + @@ against c.search_vector
- [x] Trigram fallback uses % operator (not raw similarity > threshold)
- [x] Prisma.sql template tags throughout — no string concatenation
- [x] Smoke checklist 6.1-6.10 verified locally
- [x] pnpm typecheck && pnpm lint && pnpm test clean across the api package
- [x] Commits follow lowercase Conventional Commits with scope `scramble`/`search`/`api`
```

---

## Out of scope (do not implement)

- Multi-entity search (puzzles/methods/sets) — cases-only per design
- `ts_headline` match highlights — `matchHighlight` returns null
- Search facets / filters — defer until UI exists
- Scramble length customization — cube-core's default 25
- Non-3x3 puzzles — `PUZZLE_SLUGS = ['3x3']`
- Throttler activation on /search — `ThrottlerGuard` not yet APP_GUARD-wired (sub-phase 5c)
- Caching popular search queries — defer
- Search result pagination beyond `limit` — defer
- AUF-randomized case scrambles — v2 affordance
