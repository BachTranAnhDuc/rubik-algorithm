# Plan 05 sub-phase 3 — Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five public read-only catalog endpoints (puzzles, methods, sets, cases) over the §21 schema with stable error codes and CDN-tier `Cache-Control` headers.

**Architecture:** Four NestJS submodules under `apps/api/src/modules/catalog/`, each with controller + service + service spec, aggregated by `catalog.module.ts` and wired into `app.module.ts`. Services call `PrismaService` directly (no repository layer). DTOs reuse `@rubik/shared` zod schemas via `nestjs-zod`. A composite `@PublicCacheable()` decorator wraps `@Public()` + `Cache-Control` so a single line per handler covers auth opt-out and CDN headers.

**Tech Stack:** NestJS 11, Prisma 6, `nestjs-prisma`, `nestjs-zod`, `@nestjs/swagger`, Vitest, `unplugin-swc` for decorator metadata in tests.

**Spec:** [`docs/plans/2026-04-25-api-sub-phase-3-design.md`](2026-04-25-api-sub-phase-3-design.md)
**Schema source of truth:** §21 of [`docs/plans/2026-04-25-rubik-platform-mvp-design.md`](2026-04-25-rubik-platform-mvp-design.md)
**API surface:** §5 of the same master design.

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm status --short`
Expected: branch `docs/cubing-domain-research`; status shows only the pre-existing untracked items (`.mcp.json`, `README.md`, `packages/visualizer/`).

- [ ] **Step 2: Confirm Compose Postgres and Redis are up**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml ps`
Expected: postgres + redis both `running` and `healthy`.

If not: `make services.up` from the repo root.

---

## Task 1: Drop drift fields from `@rubik/shared`

**Files:**
- Modify: `packages/shared/src/schemas/puzzle.ts`
- Modify: `packages/shared/src/schemas/puzzle.spec.ts`

The §21.2 Prisma schema doesn't model `AlgorithmVariant.videoUrl`, `AlgorithmSet.displayName`, or `AlgorithmSet.descriptionMd`. Drop them from the shared zod schemas so DTOs reflect what services can actually return.

- [ ] **Step 1.1: Edit `packages/shared/src/schemas/puzzle.ts`**

In `AlgorithmVariantSchema`, remove the line:
```ts
  videoUrl: z.string().url().nullable(),
```

In `AlgorithmSetSchema`, remove these two lines:
```ts
  displayName: z.string().nullable(),
```
```ts
  descriptionMd: z.string().nullable(),
```

After the edits, the relevant blocks should read exactly:

```ts
export const AlgorithmVariantSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  notation: z.string().min(1),
  moveCountHtm: z.number().int().nonnegative(),
  moveCountStm: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  attribution: z.string().nullable(),
  fingertrickMd: z.string().nullable(),
  displayOrder: z.number().int().nonnegative(),
})
```

```ts
export const AlgorithmSetSchema = z.object({
  id: z.string(),
  methodId: z.string(),
  slug: SlugSchema,
  name: z.string().min(1),
  caseCountExpected: z.number().int().nonnegative(),
  recognitionBasis: RecognitionBasisSchema,
  displayOrder: z.number().int().nonnegative(),
})
```

Leave the other schemas (`PuzzleSchema`, `MethodSchema`, `AlgorithmCaseSchema`, `AlgorithmCaseWithVariantsSchema`, `AlgorithmSetWithCasesSchema`) untouched. The `z.infer` type aliases at the bottom of the file pick up the changes automatically.

- [ ] **Step 1.2: Edit `packages/shared/src/schemas/puzzle.spec.ts`**

Three blocks reference the dropped fields. Make these edits:

**1.** In the `AlgorithmSetSchema` describe block (around lines 58–73), remove the `displayName: 'Permutation of Last Layer',` and `descriptionMd: null,` lines from the `safeParse({...})` payload. After: the parse object should contain only `id`, `methodId`, `slug`, `name`, `caseCountExpected`, `recognitionBasis`, `displayOrder`.

**2.** In the `AlgorithmVariantSchema` first `it(...)` block (around lines 107–122), remove the `videoUrl: 'https://www.youtube.com/watch?v=abc123',` line.

**3.** In the second `it('accepts a variant with no video', ...)` (lines 124–138), remove the `videoUrl: null,` line. The describe-block label becomes inaccurate; rename the `it` from `'accepts a variant with no video'` to `'accepts a minimal variant'`.

**4.** Delete the entire third test (`it('rejects a non-URL videoUrl', ...)`, lines 140–154 inclusive) — the assertion no longer applies because the field is gone.

- [ ] **Step 1.3: Run shared package tests**

Run: `pnpm --filter @rubik/shared test`
Expected: all tests pass (the existing tests remain green; the deleted one is no longer counted).

- [ ] **Step 1.4: Run shared package typecheck**

Run: `pnpm --filter @rubik/shared typecheck`
Expected: exit code 0.

- [ ] **Step 1.5: Run repo-wide typecheck (sanity)**

Run: `pnpm -w turbo run typecheck`
Expected: exit code 0. Confirms no other workspace consumes the dropped fields.

- [ ] **Step 1.6: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add packages/shared/src/schemas/puzzle.ts packages/shared/src/schemas/puzzle.spec.ts
git commit -m "$(cat <<'EOF'
refactor(shared): drop unused video and set-display fields

The §21.2 Prisma schema doesn't model AlgorithmVariant.videoUrl,
AlgorithmSet.displayName, or AlgorithmSet.descriptionMd. Removing them
from @rubik/shared aligns the API DTO surface with what catalog
services can actually return. Forward-looking fields can come back
when the schema and seed pipeline justify them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add catalog domain exceptions

**Files:**
- Create: `apps/api/src/modules/catalog/exceptions.ts`

Four `HttpException` subclasses with stable string codes per §18.4. The existing `AllExceptionsFilter` already shapes `HttpException` payloads with `code`/`message`/`details` into `{ error: { code, message, details? }, requestId }`.

- [ ] **Step 2.1: Create `apps/api/src/modules/catalog/exceptions.ts`**

```ts
import { HttpException, HttpStatus } from '@nestjs/common'

const buildPayload = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : {}),
})

export class PuzzleNotFoundException extends HttpException {
  constructor(slug: string) {
    super(buildPayload('puzzle_not_found', `No puzzle found for slug "${slug}"`, { slug }), HttpStatus.NOT_FOUND)
  }
}

export class MethodNotFoundException extends HttpException {
  constructor(puzzleSlug: string, methodSlug: string) {
    super(
      buildPayload('method_not_found', `No method "${methodSlug}" under puzzle "${puzzleSlug}"`, {
        puzzleSlug,
        methodSlug,
      }),
      HttpStatus.NOT_FOUND,
    )
  }
}

export class SetNotFoundException extends HttpException {
  constructor(slug: string) {
    super(buildPayload('set_not_found', `No algorithm set found for slug "${slug}"`, { slug }), HttpStatus.NOT_FOUND)
  }
}

export class CaseNotFoundException extends HttpException {
  constructor(slug: string) {
    super(buildPayload('case_not_found', `No algorithm case found for slug "${slug}"`, { slug }), HttpStatus.NOT_FOUND)
  }
}
```

- [ ] **Step 2.2: Typecheck the api**

Run: `pnpm --filter @rubik/api typecheck`
Expected: exit code 0.

- [ ] **Step 2.3: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/src/modules/catalog/exceptions.ts
git commit -m "$(cat <<'EOF'
feat(api): add catalog domain exceptions with stable codes

Four HttpException subclasses landed for the §5 catalog endpoints:
PuzzleNotFoundException, MethodNotFoundException, SetNotFoundException,
CaseNotFoundException. Each carries a stable string code (puzzle_not_found,
method_not_found, set_not_found, case_not_found) and the lookup keys in
details. AllExceptionsFilter already shapes them into the project's
{ error: { code, message, details? }, requestId } envelope.

Stable codes are part of the api contract; clients branch on code, not
message text (per .claude/rules/090-code-style-rule.md).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Puzzles module + endpoints

**Files:**
- Create: `apps/api/src/modules/catalog/puzzles/puzzles.service.ts`
- Create: `apps/api/src/modules/catalog/puzzles/__tests__/puzzles.service.spec.ts`
- Create: `apps/api/src/modules/catalog/puzzles/puzzles.controller.ts`
- Create: `apps/api/src/modules/catalog/puzzles/puzzles.module.ts`

`GET /v1/puzzles` and `GET /v1/puzzles/:puzzle/methods`. Service throws `PuzzleNotFoundException` on the second endpoint when the parent puzzle doesn't exist.

- [ ] **Step 3.1: Create the service file (stubs that throw, ready for TDD)**

Create `apps/api/src/modules/catalog/puzzles/puzzles.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { Method, Puzzle } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { PuzzleNotFoundException } from '../exceptions'

@Injectable()
export class PuzzlesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPuzzles(): Promise<Puzzle[]> {
    return this.prisma.puzzle.findMany({
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        wcaEventCode: true,
        displayOrder: true,
      },
    })
  }

  async listMethodsForPuzzle(puzzleSlug: string): Promise<Method[]> {
    const puzzle = await this.prisma.puzzle.findUnique({
      where: { slug: puzzleSlug },
      select: { id: true },
    })
    if (!puzzle) throw new PuzzleNotFoundException(puzzleSlug)

    return this.prisma.method.findMany({
      where: { puzzleId: puzzle.id },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        puzzleId: true,
        slug: true,
        name: true,
        descriptionMd: true,
        displayOrder: true,
      },
    })
  }
}
```

- [ ] **Step 3.2: Create the service spec**

Create `apps/api/src/modules/catalog/puzzles/__tests__/puzzles.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PuzzleNotFoundException } from '../../exceptions'
import { PuzzlesService } from '../puzzles.service'

const buildPrismaMock = () => ({
  puzzle: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  method: {
    findMany: vi.fn(),
  },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [PuzzlesService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(PuzzlesService)
}

describe('PuzzlesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('listPuzzles', () => {
    it('returns puzzles ordered by displayOrder', async () => {
      prisma.puzzle.findMany.mockResolvedValue([
        { id: 'p1', slug: '3x3', name: '3x3 Cube', wcaEventCode: '333', displayOrder: 0 },
      ])
      const service = await compileModule(prisma)

      const result = await service.listPuzzles()

      expect(result).toEqual([
        { id: 'p1', slug: '3x3', name: '3x3 Cube', wcaEventCode: '333', displayOrder: 0 },
      ])
      expect(prisma.puzzle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { displayOrder: 'asc' } }),
      )
    })
  })

  describe('listMethodsForPuzzle', () => {
    it('returns methods for an existing puzzle ordered by displayOrder', async () => {
      prisma.puzzle.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.method.findMany.mockResolvedValue([
        {
          id: 'm1',
          puzzleId: 'p1',
          slug: 'cfop',
          name: 'CFOP',
          descriptionMd: null,
          displayOrder: 0,
        },
      ])
      const service = await compileModule(prisma)

      const result = await service.listMethodsForPuzzle('3x3')

      expect(result).toEqual([
        {
          id: 'm1',
          puzzleId: 'p1',
          slug: 'cfop',
          name: 'CFOP',
          descriptionMd: null,
          displayOrder: 0,
        },
      ])
      expect(prisma.method.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { puzzleId: 'p1' }, orderBy: { displayOrder: 'asc' } }),
      )
    })

    it('throws PuzzleNotFoundException when the puzzle slug does not exist', async () => {
      prisma.puzzle.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.listMethodsForPuzzle('nope')).rejects.toBeInstanceOf(PuzzleNotFoundException)
      expect(prisma.method.findMany).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 3.3: Run the service spec**

Run: `pnpm --filter @rubik/api test src/modules/catalog/puzzles`
Expected: 3 tests pass.

- [ ] **Step 3.4: Create the controller**

Create `apps/api/src/modules/catalog/puzzles/puzzles.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { Method, Puzzle } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { PuzzlesService } from './puzzles.service'

@ApiTags('catalog')
@Controller({ path: 'puzzles', version: '1' })
export class PuzzlesController {
  constructor(private readonly service: PuzzlesService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'List of puzzles ordered by displayOrder' })
  list(): Promise<Puzzle[]> {
    return this.service.listPuzzles()
  }

  @Public()
  @Get(':puzzleSlug/methods')
  @ApiOkResponse({ description: 'Methods for the given puzzle' })
  @ApiNotFoundResponse({ description: 'puzzle_not_found' })
  listMethods(@Param('puzzleSlug') puzzleSlug: string): Promise<Method[]> {
    return this.service.listMethodsForPuzzle(puzzleSlug)
  }
}
```

The controller uses `@Public()` only at this stage. The composite `@PublicCacheable()` decorator lands in Task 7 and replaces these annotations.

- [ ] **Step 3.5: Create the module**

Create `apps/api/src/modules/catalog/puzzles/puzzles.module.ts`:

```ts
import { Module } from '@nestjs/common'

import { PuzzlesController } from './puzzles.controller'
import { PuzzlesService } from './puzzles.service'

@Module({
  controllers: [PuzzlesController],
  providers: [PuzzlesService],
  exports: [PuzzlesService],
})
export class PuzzlesModule {}
```

- [ ] **Step 3.6: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`
Expected: exit code 0.

- [ ] **Step 3.7: Run all api tests**

Run: `pnpm --filter @rubik/api test`
Expected: all tests pass (including the existing health controller spec).

- [ ] **Step 3.8: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/src/modules/catalog/puzzles
git commit -m "$(cat <<'EOF'
feat(api): add puzzles module + endpoints (plan 05 sub-phase 3)

Land the §5 puzzles surface:
- GET /v1/puzzles — list puzzles ordered by displayOrder.
- GET /v1/puzzles/:puzzleSlug/methods — list methods under a puzzle;
  throws PuzzleNotFoundException when the parent puzzle is missing.

Service calls PrismaService directly per §18.3 (no repository for
trivial reads). Controller uses @Public() at this stage; the composite
@PublicCacheable() decorator + module aggregator land in the next
phase 3 commit so route registration happens once.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Methods module + endpoint

**Files:**
- Create: `apps/api/src/modules/catalog/methods/methods.service.ts`
- Create: `apps/api/src/modules/catalog/methods/__tests__/methods.service.spec.ts`
- Create: `apps/api/src/modules/catalog/methods/methods.controller.ts`
- Create: `apps/api/src/modules/catalog/methods/methods.module.ts`

`GET /v1/puzzles/:puzzleSlug/methods/:methodSlug/sets`. Two-step lookup: puzzle → method by `(puzzleId, slug)`. Throws `PuzzleNotFoundException` or `MethodNotFoundException` as appropriate.

- [ ] **Step 4.1: Create the service**

Create `apps/api/src/modules/catalog/methods/methods.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { AlgorithmSet } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { MethodNotFoundException, PuzzleNotFoundException } from '../exceptions'

@Injectable()
export class MethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSetsForMethod(puzzleSlug: string, methodSlug: string): Promise<AlgorithmSet[]> {
    const puzzle = await this.prisma.puzzle.findUnique({
      where: { slug: puzzleSlug },
      select: { id: true },
    })
    if (!puzzle) throw new PuzzleNotFoundException(puzzleSlug)

    const method = await this.prisma.method.findUnique({
      where: { puzzleId_slug: { puzzleId: puzzle.id, slug: methodSlug } },
      select: { id: true },
    })
    if (!method) throw new MethodNotFoundException(puzzleSlug, methodSlug)

    return this.prisma.algorithmSet.findMany({
      where: { methodId: method.id },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        methodId: true,
        slug: true,
        name: true,
        caseCountExpected: true,
        recognitionBasis: true,
        displayOrder: true,
      },
    })
  }
}
```

- [ ] **Step 4.2: Create the service spec**

Create `apps/api/src/modules/catalog/methods/__tests__/methods.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MethodNotFoundException, PuzzleNotFoundException } from '../../exceptions'
import { MethodsService } from '../methods.service'

const buildPrismaMock = () => ({
  puzzle: { findUnique: vi.fn() },
  method: { findUnique: vi.fn() },
  algorithmSet: { findMany: vi.fn() },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [MethodsService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(MethodsService)
}

describe('MethodsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('listSetsForMethod', () => {
    it('returns sets for an existing puzzle/method pair', async () => {
      prisma.puzzle.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.method.findUnique.mockResolvedValue({ id: 'm1' })
      prisma.algorithmSet.findMany.mockResolvedValue([
        {
          id: 's1',
          methodId: 'm1',
          slug: 'pll',
          name: 'PLL',
          caseCountExpected: 21,
          recognitionBasis: 'PLL_PERMUTATION',
          displayOrder: 3,
        },
      ])
      const service = await compileModule(prisma)

      const result = await service.listSetsForMethod('3x3', 'cfop')

      expect(result).toEqual([
        {
          id: 's1',
          methodId: 'm1',
          slug: 'pll',
          name: 'PLL',
          caseCountExpected: 21,
          recognitionBasis: 'PLL_PERMUTATION',
          displayOrder: 3,
        },
      ])
      expect(prisma.algorithmSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { methodId: 'm1' }, orderBy: { displayOrder: 'asc' } }),
      )
    })

    it('throws PuzzleNotFoundException when the puzzle is missing', async () => {
      prisma.puzzle.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.listSetsForMethod('nope', 'cfop')).rejects.toBeInstanceOf(PuzzleNotFoundException)
      expect(prisma.method.findUnique).not.toHaveBeenCalled()
    })

    it('throws MethodNotFoundException when the method is missing', async () => {
      prisma.puzzle.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.method.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.listSetsForMethod('3x3', 'nope')).rejects.toBeInstanceOf(MethodNotFoundException)
      expect(prisma.algorithmSet.findMany).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 4.3: Run the spec**

Run: `pnpm --filter @rubik/api test src/modules/catalog/methods`
Expected: 3 tests pass.

- [ ] **Step 4.4: Create the controller**

Create `apps/api/src/modules/catalog/methods/methods.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AlgorithmSet } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { MethodsService } from './methods.service'

@ApiTags('catalog')
@Controller({ path: 'puzzles', version: '1' })
export class MethodsController {
  constructor(private readonly service: MethodsService) {}

  @Public()
  @Get(':puzzleSlug/methods/:methodSlug/sets')
  @ApiOkResponse({ description: 'Algorithm sets for the given method' })
  @ApiNotFoundResponse({ description: 'puzzle_not_found or method_not_found' })
  listSets(
    @Param('puzzleSlug') puzzleSlug: string,
    @Param('methodSlug') methodSlug: string,
  ): Promise<AlgorithmSet[]> {
    return this.service.listSetsForMethod(puzzleSlug, methodSlug)
  }
}
```

The controller is rooted at `puzzles` because the URL begins `/v1/puzzles/:puzzleSlug/methods/...`. Two controllers can share the same `path`; NestJS routes them by the per-handler path suffix.

- [ ] **Step 4.5: Create the module**

Create `apps/api/src/modules/catalog/methods/methods.module.ts`:

```ts
import { Module } from '@nestjs/common'

import { MethodsController } from './methods.controller'
import { MethodsService } from './methods.service'

@Module({
  controllers: [MethodsController],
  providers: [MethodsService],
  exports: [MethodsService],
})
export class MethodsModule {}
```

- [ ] **Step 4.6: Typecheck and run all api tests**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api test`
Expected: typecheck exit 0; all tests pass.

- [ ] **Step 4.7: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/src/modules/catalog/methods
git commit -m "$(cat <<'EOF'
feat(api): add methods module + endpoint (phase 3)

Land GET /v1/puzzles/:puzzleSlug/methods/:methodSlug/sets per §5.
Two-step Prisma lookup (puzzle by slug → method by composite
puzzleId+slug unique) with stable not-found codes for either step.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Sets module + endpoint

**Files:**
- Create: `apps/api/src/modules/catalog/sets/sets.service.ts`
- Create: `apps/api/src/modules/catalog/sets/__tests__/sets.service.spec.ts`
- Create: `apps/api/src/modules/catalog/sets/sets.controller.ts`
- Create: `apps/api/src/modules/catalog/sets/sets.module.ts`

`GET /v1/sets/:setSlug` returns a set with its cases and each case's variants (denormalized for the case-grid page). Slug lookup is global; per the design's §6, content discipline keeps slugs unique across sets in v1, with `displayOrder` as a deterministic tiebreaker.

- [ ] **Step 5.1: Create the service**

Create `apps/api/src/modules/catalog/sets/sets.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { AlgorithmSetWithCases } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { SetNotFoundException } from '../exceptions'

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetBySlug(slug: string): Promise<AlgorithmSetWithCases> {
    const set = await this.prisma.algorithmSet.findFirst({
      where: { slug },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        methodId: true,
        slug: true,
        name: true,
        caseCountExpected: true,
        recognitionBasis: true,
        displayOrder: true,
        cases: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            setId: true,
            slug: true,
            name: true,
            displayName: true,
            displayOrder: true,
            caseState: true,
            recognitionMd: true,
            tags: true,
            variants: {
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true,
                caseId: true,
                notation: true,
                moveCountHtm: true,
                moveCountStm: true,
                isPrimary: true,
                attribution: true,
                fingertrickMd: true,
                displayOrder: true,
              },
            },
          },
        },
      },
    })

    if (!set) throw new SetNotFoundException(slug)
    return set
  }
}
```

- [ ] **Step 5.2: Create the spec**

Create `apps/api/src/modules/catalog/sets/__tests__/sets.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SetNotFoundException } from '../../exceptions'
import { SetsService } from '../sets.service'

const buildPrismaMock = () => ({
  algorithmSet: { findFirst: vi.fn() },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [SetsService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(SetsService)
}

const sampleSetWithCases = {
  id: 's1',
  methodId: 'm1',
  slug: 'pll',
  name: 'PLL',
  caseCountExpected: 21,
  recognitionBasis: 'PLL_PERMUTATION' as const,
  displayOrder: 3,
  cases: [
    {
      id: 'c1',
      setId: 's1',
      slug: 't-perm',
      name: 'T Perm',
      displayName: 'T-Perm',
      displayOrder: 14,
      caseState: 'x'.repeat(54),
      recognitionMd: null,
      tags: ['adjacent-corner-swap'],
      variants: [
        {
          id: 'v1',
          caseId: 'c1',
          notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
          moveCountHtm: 14,
          moveCountStm: 14,
          isPrimary: true,
          attribution: null,
          fingertrickMd: null,
          displayOrder: 0,
        },
      ],
    },
  ],
}

describe('SetsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('getSetBySlug', () => {
    it('returns the set with denormalized cases and variants', async () => {
      prisma.algorithmSet.findFirst.mockResolvedValue(sampleSetWithCases)
      const service = await compileModule(prisma)

      const result = await service.getSetBySlug('pll')

      expect(result).toEqual(sampleSetWithCases)
      expect(prisma.algorithmSet.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'pll' }, orderBy: { displayOrder: 'asc' } }),
      )
    })

    it('throws SetNotFoundException when the slug does not exist', async () => {
      prisma.algorithmSet.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.getSetBySlug('nope')).rejects.toBeInstanceOf(SetNotFoundException)
    })
  })
})
```

- [ ] **Step 5.3: Run the spec**

Run: `pnpm --filter @rubik/api test src/modules/catalog/sets`
Expected: 2 tests pass.

- [ ] **Step 5.4: Create the controller**

Create `apps/api/src/modules/catalog/sets/sets.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AlgorithmSetWithCases } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { SetsService } from './sets.service'

@ApiTags('catalog')
@Controller({ path: 'sets', version: '1' })
export class SetsController {
  constructor(private readonly service: SetsService) {}

  @Public()
  @Get(':setSlug')
  @ApiOkResponse({ description: 'Set detail with cases + variants (denormalized)' })
  @ApiNotFoundResponse({ description: 'set_not_found' })
  get(@Param('setSlug') setSlug: string): Promise<AlgorithmSetWithCases> {
    return this.service.getSetBySlug(setSlug)
  }
}
```

- [ ] **Step 5.5: Create the module**

Create `apps/api/src/modules/catalog/sets/sets.module.ts`:

```ts
import { Module } from '@nestjs/common'

import { SetsController } from './sets.controller'
import { SetsService } from './sets.service'

@Module({
  controllers: [SetsController],
  providers: [SetsService],
  exports: [SetsService],
})
export class SetsModule {}
```

- [ ] **Step 5.6: Typecheck and test**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api test`
Expected: typecheck exit 0; all tests pass.

- [ ] **Step 5.7: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/src/modules/catalog/sets
git commit -m "$(cat <<'EOF'
feat(api): add sets module + endpoint (phase 3)

Land GET /v1/sets/:setSlug per §5. Returns the set + nested cases +
nested variants in a single Prisma round-trip (select + nested
include) so the case-grid page can render without follow-up requests.

Slug lookup is global (findFirst by slug); v1 content discipline keeps
set slugs unique across methods, with displayOrder as a deterministic
tiebreaker. v2 may scope to /methods/:method/sets/:set if collisions
become real.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Cases module + endpoint

**Files:**
- Create: `apps/api/src/modules/catalog/cases/cases.service.ts`
- Create: `apps/api/src/modules/catalog/cases/__tests__/cases.service.spec.ts`
- Create: `apps/api/src/modules/catalog/cases/cases.controller.ts`
- Create: `apps/api/src/modules/catalog/cases/cases.module.ts`

`GET /v1/cases/:caseSlug` returns a case with its variants ordered by `displayOrder`.

- [ ] **Step 6.1: Create the service**

Create `apps/api/src/modules/catalog/cases/cases.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { AlgorithmCaseWithVariants } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { CaseNotFoundException } from '../exceptions'

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCaseBySlug(slug: string): Promise<AlgorithmCaseWithVariants> {
    const caseRow = await this.prisma.algorithmCase.findFirst({
      where: { slug },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        setId: true,
        slug: true,
        name: true,
        displayName: true,
        displayOrder: true,
        caseState: true,
        recognitionMd: true,
        tags: true,
        variants: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            caseId: true,
            notation: true,
            moveCountHtm: true,
            moveCountStm: true,
            isPrimary: true,
            attribution: true,
            fingertrickMd: true,
            displayOrder: true,
          },
        },
      },
    })

    if (!caseRow) throw new CaseNotFoundException(slug)
    return caseRow
  }
}
```

- [ ] **Step 6.2: Create the spec**

Create `apps/api/src/modules/catalog/cases/__tests__/cases.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseNotFoundException } from '../../exceptions'
import { CasesService } from '../cases.service'

const buildPrismaMock = () => ({
  algorithmCase: { findFirst: vi.fn() },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [CasesService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(CasesService)
}

const sampleCase = {
  id: 'c1',
  setId: 's1',
  slug: 't-perm',
  name: 'T Perm',
  displayName: 'T-Perm',
  displayOrder: 14,
  caseState: 'x'.repeat(54),
  recognitionMd: null,
  tags: ['adjacent-corner-swap'],
  variants: [
    {
      id: 'v1',
      caseId: 'c1',
      notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
      moveCountHtm: 14,
      moveCountStm: 14,
      isPrimary: true,
      attribution: null,
      fingertrickMd: null,
      displayOrder: 0,
    },
  ],
}

describe('CasesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('getCaseBySlug', () => {
    it('returns the case with variants ordered by displayOrder', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(sampleCase)
      const service = await compileModule(prisma)

      const result = await service.getCaseBySlug('t-perm')

      expect(result).toEqual(sampleCase)
      expect(prisma.algorithmCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 't-perm' } }),
      )
    })

    it('throws CaseNotFoundException when the slug does not exist', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.getCaseBySlug('nope')).rejects.toBeInstanceOf(CaseNotFoundException)
    })
  })
})
```

- [ ] **Step 6.3: Run the spec**

Run: `pnpm --filter @rubik/api test src/modules/catalog/cases`
Expected: 2 tests pass.

- [ ] **Step 6.4: Create the controller**

Create `apps/api/src/modules/catalog/cases/cases.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AlgorithmCaseWithVariants } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { CasesService } from './cases.service'

@ApiTags('catalog')
@Controller({ path: 'cases', version: '1' })
export class CasesController {
  constructor(private readonly service: CasesService) {}

  @Public()
  @Get(':caseSlug')
  @ApiOkResponse({ description: 'Case detail with variants' })
  @ApiNotFoundResponse({ description: 'case_not_found' })
  get(@Param('caseSlug') caseSlug: string): Promise<AlgorithmCaseWithVariants> {
    return this.service.getCaseBySlug(caseSlug)
  }
}
```

- [ ] **Step 6.5: Create the module**

Create `apps/api/src/modules/catalog/cases/cases.module.ts`:

```ts
import { Module } from '@nestjs/common'

import { CasesController } from './cases.controller'
import { CasesService } from './cases.service'

@Module({
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
```

- [ ] **Step 6.6: Typecheck and test**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api test`
Expected: typecheck exit 0; all tests pass.

- [ ] **Step 6.7: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/src/modules/catalog/cases
git commit -m "$(cat <<'EOF'
feat(api): add cases module + endpoint (phase 3)

Land GET /v1/cases/:caseSlug per §5. Returns the case + variants
ordered by displayOrder. Same global-slug strategy as /v1/sets/:set —
v1 content discipline keeps case slugs unique across sets.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Aggregator + `@PublicCacheable()` decorator + `app.module.ts` wiring

**Files:**
- Create: `apps/api/src/common/decorators/public-cacheable.decorator.ts`
- Create: `apps/api/src/modules/catalog/catalog.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: all four catalog controllers (`puzzles`, `methods`, `sets`, `cases`) — swap `@Public()` for `@PublicCacheable()`.

This is the "flip on" commit. Until now, the catalog submodules existed but weren't routed. This commit registers them and adds CDN cache headers in one shot.

- [ ] **Step 7.1: Create the `@PublicCacheable` decorator**

Create `apps/api/src/common/decorators/public-cacheable.decorator.ts`:

```ts
import { applyDecorators, Header } from '@nestjs/common'

import { Public } from './public.decorator'

const TEN_MINUTES = 600
const ONE_DAY = 86400

type PublicCacheableOptions = {
  sMaxAge?: number
  staleWhileRevalidate?: number
}

export const PublicCacheable = (options?: PublicCacheableOptions): MethodDecorator & ClassDecorator => {
  const sMaxAge = options?.sMaxAge ?? TEN_MINUTES
  const swr = options?.staleWhileRevalidate ?? ONE_DAY
  return applyDecorators(
    Public(),
    Header('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`),
  )
}
```

- [ ] **Step 7.2: Create the catalog aggregator module**

Create `apps/api/src/modules/catalog/catalog.module.ts`:

```ts
import { Module } from '@nestjs/common'

import { CasesModule } from './cases/cases.module'
import { MethodsModule } from './methods/methods.module'
import { PuzzlesModule } from './puzzles/puzzles.module'
import { SetsModule } from './sets/sets.module'

@Module({
  imports: [PuzzlesModule, MethodsModule, SetsModule, CasesModule],
})
export class CatalogModule {}
```

No re-exports — submodules already export their services for any future cross-module consumer. The aggregator is purely a routing wrapper.

- [ ] **Step 7.3: Register `CatalogModule` in `app.module.ts`**

Edit `apps/api/src/app.module.ts`. Add the import:

```ts
import { CatalogModule } from './modules/catalog/catalog.module'
```

Add `CatalogModule` to the `imports` array, after `HealthModule`:

```ts
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    TelemetryModule,
    HealthModule,
    CatalogModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

- [ ] **Step 7.4: Update `puzzles.controller.ts` to use `@PublicCacheable()`**

Edit `apps/api/src/modules/catalog/puzzles/puzzles.controller.ts`:

Replace the import line:
```ts
import { Public } from '../../../common/decorators/public.decorator'
```
with:
```ts
import { PublicCacheable } from '../../../common/decorators/public-cacheable.decorator'
```

Replace each `@Public()` with `@PublicCacheable()`. The two annotations on `list()` and `listMethods()` change from:

```ts
  @Public()
  @Get()
```
to:
```ts
  @PublicCacheable()
  @Get()
```

…and similarly for the second handler.

- [ ] **Step 7.5: Update `methods.controller.ts` to use `@PublicCacheable()`**

Edit `apps/api/src/modules/catalog/methods/methods.controller.ts`:

Replace the import:
```ts
import { Public } from '../../../common/decorators/public.decorator'
```
with:
```ts
import { PublicCacheable } from '../../../common/decorators/public-cacheable.decorator'
```

Replace `@Public()` with `@PublicCacheable()` on the single handler.

- [ ] **Step 7.6: Update `sets.controller.ts` to use `@PublicCacheable()`**

Edit `apps/api/src/modules/catalog/sets/sets.controller.ts`:

Replace the import:
```ts
import { Public } from '../../../common/decorators/public.decorator'
```
with:
```ts
import { PublicCacheable } from '../../../common/decorators/public-cacheable.decorator'
```

Replace `@Public()` with `@PublicCacheable()` on the single handler.

- [ ] **Step 7.7: Update `cases.controller.ts` to use `@PublicCacheable()`**

Edit `apps/api/src/modules/catalog/cases/cases.controller.ts`:

Replace the import:
```ts
import { Public } from '../../../common/decorators/public.decorator'
```
with:
```ts
import { PublicCacheable } from '../../../common/decorators/public-cacheable.decorator'
```

Replace `@Public()` with `@PublicCacheable()` on the single handler.

- [ ] **Step 7.8: Typecheck and run all api tests**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api test`
Expected: typecheck exit 0; all tests pass (specs are unaffected by the controller decorator swap).

- [ ] **Step 7.9: Boot the api and verify routes register**

Run: `pnpm --filter @rubik/api dev > /tmp/rubik-api.log 2>&1 &`

Wait ~8 seconds for boot, then:

Run: `grep -E 'Mapped \\{' /tmp/rubik-api.log`
Expected: lines mentioning all of:
- `Mapped {/puzzles, GET}`
- `Mapped {/puzzles/:puzzleSlug/methods, GET}`
- `Mapped {/puzzles/:puzzleSlug/methods/:methodSlug/sets, GET}`
- `Mapped {/sets/:setSlug, GET}`
- `Mapped {/cases/:caseSlug, GET}`

…plus the existing health routes.

Stop the api: `pkill -f 'node --watch --import @swc-node/register' || true`

- [ ] **Step 7.10: Commit**

```bash
cd /home/ducbach/Documents/study/rubik-algorithm
git add apps/api/src/common/decorators/public-cacheable.decorator.ts apps/api/src/modules/catalog/catalog.module.ts apps/api/src/app.module.ts apps/api/src/modules/catalog/puzzles/puzzles.controller.ts apps/api/src/modules/catalog/methods/methods.controller.ts apps/api/src/modules/catalog/sets/sets.controller.ts apps/api/src/modules/catalog/cases/cases.controller.ts
git commit -m "$(cat <<'EOF'
feat(api): aggregate catalog and add public-cacheable decorator (phase 3)

Flip the catalog on. CatalogModule imports the four submodules and
ships in app.module.ts so all five §5 endpoints become reachable. A
new @PublicCacheable() composite decorator wraps @Public() with
Cache-Control: public, s-maxage=600, stale-while-revalidate=86400 —
matches §18.4's CDN-tier defaults. All four catalog controllers swap
from @Public() to @PublicCacheable() in this commit so the auth-public
contract and CDN headers always travel together.

Redis cache-manager interception (the §18.4 second tier) lands in
sub-phase 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: End-to-end smoke test

No files modified. Live verification that all five endpoints respond correctly.

- [ ] **Step 8.1: Boot the api**

Run: `pnpm --filter @rubik/api dev > /tmp/rubik-api.log 2>&1 &`

Wait until port 3001 is listening (background `until ss -tln | grep -q ':3001\\b'; do sleep 1; done` or `sleep 8`).

- [ ] **Step 8.2: Hit `/v1/puzzles` (empty DB → empty array, 200)**

Run: `curl -sS -o /tmp/puzzles.json -w 'HTTP %{http_code}\\n' http://localhost:3001/v1/puzzles`
Expected: `HTTP 200`. `cat /tmp/puzzles.json` shows `[]` (DB has no seed data yet).

Run: `curl -sS -I http://localhost:3001/v1/puzzles | grep -i cache-control`
Expected: a header `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`.

- [ ] **Step 8.3: Hit `/v1/puzzles/3x3/methods` (puzzle missing → 404)**

Run: `curl -sS -o /tmp/methods.json -w 'HTTP %{http_code}\\n' http://localhost:3001/v1/puzzles/3x3/methods`
Expected: `HTTP 404`. `cat /tmp/methods.json` parses to `{"error":{"code":"puzzle_not_found", "message":"...", "details":{"slug":"3x3"}}, "requestId":"..."}`.

- [ ] **Step 8.4: Hit `/v1/puzzles/3x3/methods/cfop/sets` (puzzle missing → 404)**

Run: `curl -sS -o /tmp/sets.json -w 'HTTP %{http_code}\\n' http://localhost:3001/v1/puzzles/3x3/methods/cfop/sets`
Expected: `HTTP 404`. Body `error.code === 'puzzle_not_found'` (the puzzle layer fails first; method check is short-circuited).

- [ ] **Step 8.5: Hit `/v1/sets/pll` (set missing → 404)**

Run: `curl -sS -o /tmp/setdetail.json -w 'HTTP %{http_code}\\n' http://localhost:3001/v1/sets/pll`
Expected: `HTTP 404`. Body `error.code === 'set_not_found'`.

- [ ] **Step 8.6: Hit `/v1/cases/t-perm` (case missing → 404)**

Run: `curl -sS -o /tmp/casedetail.json -w 'HTTP %{http_code}\\n' http://localhost:3001/v1/cases/t-perm`
Expected: `HTTP 404`. Body `error.code === 'case_not_found'`.

- [ ] **Step 8.7: Confirm Swagger UI exposes the endpoints**

Run: `curl -sS http://localhost:3001/v1/docs | grep -E 'puzzles|methods|sets|cases' | head -5`
Expected: at least a few HTML lines containing the endpoint paths or the `catalog` ApiTag. (Swagger UI is the same HTML page; the JSON spec lives at `/v1/docs-json` if needed.)

Optional: `curl -sS http://localhost:3001/v1/docs-json | jq '.paths | keys'` — should list the five new paths.

- [ ] **Step 8.8: Stop the api**

Run: `pkill -f 'node --watch --import @swc-node/register' || true`
Run: `ss -tln | grep -q ':3001\\b' && echo 'STILL LISTENING' || echo 'port free'`
Expected: `port free`.

---

## Task 9: Spec coverage review

- [ ] **Step 9.1: Walk the spec's Done-when checklist**

Open `docs/plans/2026-04-25-api-sub-phase-3-design.md`. For each box:

- `@rubik/shared` no longer exports `videoUrl`/`displayName`/`descriptionMd` — Task 1.
- `apps/api/src/modules/catalog/exceptions.ts` exports four `*NotFoundException` classes with stable codes — Task 2.
- Each `catalog/{puzzles,methods,sets,cases}/` has module + controller + service + service spec — Tasks 3–6.
- `catalog.module.ts` aggregates the four submodules; `app.module.ts` imports it — Task 7.
- `public-cacheable.decorator.ts` wraps `@Public()` + `Cache-Control` header — Task 7.1.
- All five endpoints respond with §5-shaped JSON — Task 8 (200 verified for `/v1/puzzles`; the others verified with empty-DB 404 responses).
- All five emit `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400` — Task 8.2 (and the same decorator is used on every catalog handler).
- All four not-found cases return HTTP 404 with `error.code` matching `*_not_found` — Tasks 8.3–8.6.
- `pnpm --filter @rubik/api typecheck` clean — Task 7.8.
- `pnpm --filter @rubik/api test` runs all four service specs green — Task 7.8.
- `make dev.api` boots; Swagger UI lists the new endpoints — Tasks 8.1, 8.7.
- `git status --short` clean — Step 9.2.

- [ ] **Step 9.2: Confirm no in-progress edits leaked**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm status --short`
Expected: only the pre-existing untracked items (`.mcp.json`, `README.md`, `packages/visualizer/`). No staged changes.

- [ ] **Step 9.3: Print the resulting commit summary**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline 8e23ed3..HEAD`
Expected: the seven phase-3 commits in order:
```
<sha> feat(api): aggregate catalog and add public-cacheable decorator (phase 3)
<sha> feat(api): add cases module + endpoint (phase 3)
<sha> feat(api): add sets module + endpoint (phase 3)
<sha> feat(api): add methods module + endpoint (phase 3)
<sha> feat(api): add puzzles module + endpoints (plan 05 sub-phase 3)
<sha> feat(api): add catalog domain exceptions with stable codes
<sha> refactor(shared): drop unused video and set-display fields
```
