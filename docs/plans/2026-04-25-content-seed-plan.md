# Plan 06 — Content seed pipeline + initial content (Implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the YAML → DB seed pipeline (deferred from plan 05) and author the first 9 algorithm cases (3 each for F2L/OLL/PLL) so `curl /v1/sets/pll` returns a real T-Perm.

**Architecture:** `apps/api/prisma/seed.ts` is the CLI entry (parses `--validate-only`, `--dry-run`, `--prune`). It dispatches to three pure modules under `apps/api/prisma/seed/`: `load-content.ts` (recursive YAML walk + parse), `validate-content.ts` (zod + cube-core notation cross-check), and `upsert-content.ts` (Prisma upserts in dependency order with per-case variant `deleteMany + createMany`). Content YAML lives at `content/puzzles/3x3/...` per §22; fixtures duplicate 2 cases per set under `content/fixtures/`.

**Tech Stack:** Prisma 6, NestJS 11 (api package only — seed runs outside Nest DI as a Prisma seed script), `@rubik/shared` (zod content schemas), `@rubik/cube-core` (notation parser + state functions + canonical algorithm references), `tsx` (TypeScript runner), `js-yaml` (YAML parser), Vitest.

**Spec:** [`docs/plans/2026-04-25-content-seed-design.md`](2026-04-25-content-seed-design.md) (commit `6c374e9`)

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline -3`

Expected: branch `plan-06-content-seed`; latest commit is `6c374e9 docs(plans): add content-seed design for plan 06`.

- [ ] **Step 2: Confirm Compose Postgres + Redis are up**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml ps`

Expected: postgres + redis both running and healthy. If not: `make services.up` from the repo root.

- [ ] **Step 3: Confirm api unit tests are green at HEAD**

Run: `pnpm --filter @rubik/api test`

Expected: 51 tests pass (state from sub-phase 4 closure).

---

## Task 1: Wire seed dependencies and scripts

**Files:**
- Modify: `apps/api/package.json`

Add `tsx` (devDep), `js-yaml` + `@types/js-yaml` (deps + devDeps), the `prisma.seed` config so `prisma db seed` knows what to run, and convenience scripts.

- [ ] **Step 1.1: Install runtime dependencies**

Run: `pnpm --filter @rubik/api add js-yaml`

Expected: `js-yaml` lands in `apps/api/package.json` `dependencies`.

- [ ] **Step 1.2: Install devDependencies**

Run: `pnpm --filter @rubik/api add -D tsx @types/js-yaml`

Expected: `tsx` and `@types/js-yaml` land in `devDependencies`.

- [ ] **Step 1.3: Add `prisma.seed` config and convenience scripts to `apps/api/package.json`**

After the `"scripts": { ... }` block, add a sibling top-level `"prisma"` block:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
},
```

Inside `"scripts": { ... }`, add:

```json
"seed": "tsx prisma/seed.ts",
"content:validate": "tsx prisma/seed.ts --validate-only"
```

(Keep existing `build`, `dev`, `start`, `lint`, `typecheck`, `test`, `clean` scripts intact.)

- [ ] **Step 1.4: Confirm typecheck still clean**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean (no source changes; just metadata).

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(tooling): add tsx + js-yaml deps and prisma.seed config

Wires the prerequisites for the content-seed pipeline: tsx (TypeScript
runner used by `prisma db seed`), js-yaml (YAML parser for content/),
and the prisma.seed config so `prisma db seed` and `make db.seed`
both invoke prisma/seed.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: load-content.ts — recursive YAML walk + parse

**Files:**
- Create: `apps/api/prisma/seed/load-content.ts`
- Create: `apps/api/prisma/seed/__tests__/load-content.spec.ts`
- Create: `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/puzzle.yaml`
- Create: `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/methods/cfop/method.yaml`
- Create: `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/methods/cfop/sets/pll/set.yaml`
- Create: `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml`

`loadContent(rootDir)` walks the tree under `rootDir`, parses every `*.yaml` file, and returns a typed bundle keyed by file path.

- [ ] **Step 2.1: Create the spec fixtures**

Create `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/puzzle.yaml`:

```yaml
slug: 3x3
name: 3x3
display_name: 3x3 Cube
wca_event_code: "333"
display_order: 0
state_schema_version: v1
```

Create `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/methods/cfop/method.yaml`:

```yaml
slug: cfop
name: CFOP
display_order: 0
description_md: null
```

Create `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/methods/cfop/sets/pll/set.yaml`:

```yaml
slug: pll
name: PLL
display_name: Permutation of the Last Layer
case_count_expected: 21
recognition_basis: PLL_PERMUTATION
display_order: 2
description_md: null
```

Create `apps/api/prisma/seed/__tests__/fixtures/sample-tree/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml`:

```yaml
slug: t-perm
name: T-Perm
display_name: T-Perm
display_order: 0
case_state: "UUUUUUUUUFRFRRRRRRRFRFFFFFFDDDDDDDDDLBLLLLLLLBLBBBBBBB"
recognition_md: null
tags:
  - pll
  - edge-corner-3-cycle
variants:
  - notation: "R U R' U' R' F R2 U' R' U' R U R' F'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

(The case_state is the canonical T-Perm state from cube-core's `PLL_ALGORITHMS['T']`. We will verify it in Task 4 / Task 10.)

- [ ] **Step 2.2: Write the failing spec**

Create `apps/api/prisma/seed/__tests__/load-content.spec.ts`:

```ts
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadContent } from '../load-content'

const FIXTURE_ROOT = join(__dirname, 'fixtures', 'sample-tree')

describe('loadContent', () => {
  it('walks the tree and parses every yaml file into a typed bundle', async () => {
    const bundle = await loadContent(FIXTURE_ROOT)

    expect(bundle.puzzles).toHaveLength(1)
    expect(bundle.puzzles[0].data.slug).toBe('3x3')

    expect(bundle.methods).toHaveLength(1)
    expect(bundle.methods[0].puzzleSlug).toBe('3x3')
    expect(bundle.methods[0].data.slug).toBe('cfop')

    expect(bundle.sets).toHaveLength(1)
    expect(bundle.sets[0].puzzleSlug).toBe('3x3')
    expect(bundle.sets[0].methodSlug).toBe('cfop')
    expect(bundle.sets[0].data.slug).toBe('pll')

    expect(bundle.cases).toHaveLength(1)
    const tperm = bundle.cases[0]
    expect(tperm.setSlug).toBe('pll')
    expect(tperm.data.slug).toBe('t-perm')
    expect(tperm.data.variants[0].is_primary).toBe(true)
  })

  it('throws when the root directory does not exist', async () => {
    await expect(loadContent('/nonexistent/path/to/content')).rejects.toThrow(/does not exist/)
  })
})
```

- [ ] **Step 2.3: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test prisma/seed/__tests__/load-content.spec.ts`

Expected: FAIL with "Cannot find module '../load-content'".

- [ ] **Step 2.4: Create `apps/api/prisma/seed/load-content.ts`**

```ts
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'

import { load as parseYaml } from 'js-yaml'

export interface LoadedPuzzle {
  filePath: string
  data: Record<string, unknown>
}

export interface LoadedMethod {
  filePath: string
  puzzleSlug: string
  data: Record<string, unknown>
}

export interface LoadedSet {
  filePath: string
  puzzleSlug: string
  methodSlug: string
  data: Record<string, unknown>
}

export interface LoadedCase {
  filePath: string
  puzzleSlug: string
  methodSlug: string
  setSlug: string
  data: Record<string, unknown>
}

export interface ContentBundle {
  puzzles: LoadedPuzzle[]
  methods: LoadedMethod[]
  sets: LoadedSet[]
  cases: LoadedCase[]
}

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

const readYaml = async (filePath: string): Promise<Record<string, unknown>> => {
  const raw = await readFile(filePath, 'utf8')
  const parsed = parseYaml(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${filePath}: expected a YAML mapping at the document root`)
  }
  return parsed as Record<string, unknown>
}

const listSubdirs = async (path: string): Promise<string[]> => {
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

const listYamlFiles = async (path: string): Promise<string[]> => {
  if (!(await directoryExists(path))) return []
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isFile() && e.name.endsWith('.yaml')).map((e) => e.name)
}

export const loadContent = async (rootDir: string): Promise<ContentBundle> => {
  if (!(await directoryExists(rootDir))) {
    throw new Error(`content directory does not exist: ${rootDir}`)
  }

  const bundle: ContentBundle = { puzzles: [], methods: [], sets: [], cases: [] }
  const puzzlesDir = join(rootDir, 'puzzles')
  if (!(await directoryExists(puzzlesDir))) return bundle

  for (const puzzleSlug of await listSubdirs(puzzlesDir)) {
    const puzzleRoot = join(puzzlesDir, puzzleSlug)
    const puzzleFile = join(puzzleRoot, 'puzzle.yaml')
    if (await directoryExists(puzzleRoot)) {
      try {
        const data = await readYaml(puzzleFile)
        bundle.puzzles.push({ filePath: puzzleFile, data })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }

    const methodsDir = join(puzzleRoot, 'methods')
    if (!(await directoryExists(methodsDir))) continue

    for (const methodSlug of await listSubdirs(methodsDir)) {
      const methodRoot = join(methodsDir, methodSlug)
      const methodFile = join(methodRoot, 'method.yaml')
      try {
        const data = await readYaml(methodFile)
        bundle.methods.push({ filePath: methodFile, puzzleSlug, data })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }

      const setsDir = join(methodRoot, 'sets')
      if (!(await directoryExists(setsDir))) continue

      for (const setSlug of await listSubdirs(setsDir)) {
        const setRoot = join(setsDir, setSlug)
        const setFile = join(setRoot, 'set.yaml')
        try {
          const data = await readYaml(setFile)
          bundle.sets.push({ filePath: setFile, puzzleSlug, methodSlug, data })
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }

        const casesDir = join(setRoot, 'cases')
        for (const caseFile of await listYamlFiles(casesDir)) {
          const filePath = join(casesDir, caseFile)
          const data = await readYaml(filePath)
          bundle.cases.push({ filePath, puzzleSlug, methodSlug, setSlug, data })
        }
      }
    }
  }

  return bundle
}

export const __forTest = { sep }
```

- [ ] **Step 2.5: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test prisma/seed/__tests__/load-content.spec.ts`

Expected: PASS — 2 tests.

- [ ] **Step 2.6: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 2.7: Commit**

```bash
git add apps/api/prisma/seed/load-content.ts apps/api/prisma/seed/__tests__/
git commit -m "$(cat <<'EOF'
feat(prisma): add load-content for recursive yaml walk

Walks content/puzzles/<slug>/methods/<slug>/sets/<slug>/cases/*.yaml,
parses each YAML into a tagged bundle (puzzles/methods/sets/cases) so
downstream stages can validate and upsert in dependency order without
re-walking the tree.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: validate-content.ts — zod schema + cube-core cross-check

**Files:**
- Create: `apps/api/prisma/seed/validate-content.ts`
- Create: `apps/api/prisma/seed/__tests__/validate-content.spec.ts`

`validateContent(bundle)` runs each loaded record through its `@rubik/shared` schema, then for every case file applies the primary algorithm to the case_state and asserts solved (per §060). Throws on the first failure with a precise file path + reason message.

- [ ] **Step 3.1: Write the failing spec**

Create `apps/api/prisma/seed/__tests__/validate-content.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { ContentBundle, LoadedCase } from '../load-content'
import { validateContent } from '../validate-content'

const validPuzzle = (data: Record<string, unknown> = {}) => ({
  filePath: '/tmp/puzzle.yaml',
  data: {
    slug: '3x3',
    name: '3x3',
    display_name: '3x3 Cube',
    wca_event_code: '333',
    display_order: 0,
    state_schema_version: 'v1',
    ...data,
  },
})

const validMethod = (data: Record<string, unknown> = {}) => ({
  filePath: '/tmp/method.yaml',
  puzzleSlug: '3x3',
  data: { slug: 'cfop', name: 'CFOP', display_order: 0, description_md: null, ...data },
})

const validSet = (data: Record<string, unknown> = {}) => ({
  filePath: '/tmp/set.yaml',
  puzzleSlug: '3x3',
  methodSlug: 'cfop',
  data: {
    slug: 'pll',
    name: 'PLL',
    display_name: 'Permutation of the Last Layer',
    case_count_expected: 21,
    recognition_basis: 'PLL_PERMUTATION',
    display_order: 2,
    description_md: null,
    ...data,
  },
})

const TPERM_STATE = 'UUUUUUUUUFRFRRRRRRRFRFFFFFFDDDDDDDDDLBLLLLLLLBLBBBBBBB'
const TPERM_ALG = "R U R' U' R' F R2 U' R' U' R U R' F'"

const validCase = (overrides: Record<string, unknown> = {}): LoadedCase => ({
  filePath: '/tmp/t-perm.yaml',
  puzzleSlug: '3x3',
  methodSlug: 'cfop',
  setSlug: 'pll',
  data: {
    slug: 't-perm',
    name: 'T-Perm',
    display_name: 'T-Perm',
    display_order: 0,
    case_state: TPERM_STATE,
    recognition_md: null,
    tags: ['pll'],
    variants: [
      {
        notation: TPERM_ALG,
        is_primary: true,
        attribution: null,
        fingertrick_md: null,
        video_url: null,
      },
    ],
    ...overrides,
  },
})

const buildBundle = (parts: Partial<ContentBundle> = {}): ContentBundle => ({
  puzzles: parts.puzzles ?? [validPuzzle()],
  methods: parts.methods ?? [validMethod()],
  sets: parts.sets ?? [validSet()],
  cases: parts.cases ?? [validCase()],
})

describe('validateContent', () => {
  it('accepts a well-formed bundle including the canonical T-Perm case', () => {
    expect(() => validateContent(buildBundle())).not.toThrow()
  })

  it('rejects a case whose case_state is not 54 chars', () => {
    const bad = validCase({ case_state: 'UUU' })
    expect(() => validateContent(buildBundle({ cases: [bad] }))).toThrow(/case_state/)
  })

  it('rejects a case with two is_primary variants', () => {
    const bad = validCase({
      variants: [
        { notation: TPERM_ALG, is_primary: true, attribution: null, fingertrick_md: null, video_url: null },
        { notation: "R U R'", is_primary: true, attribution: null, fingertrick_md: null, video_url: null },
      ],
    })
    expect(() => validateContent(buildBundle({ cases: [bad] }))).toThrow(/is_primary/)
  })

  it('rejects a case whose primary notation does not solve case_state', () => {
    const bad = validCase({
      variants: [
        { notation: "R U R'", is_primary: true, attribution: null, fingertrick_md: null, video_url: null },
      ],
    })
    expect(() => validateContent(buildBundle({ cases: [bad] }))).toThrow(/does not solve case_state/)
  })

  it('rejects a slug that is not kebab-case', () => {
    const bad = { ...validPuzzle(), data: { ...validPuzzle().data, slug: 'NotKebab' } }
    expect(() => validateContent(buildBundle({ puzzles: [bad] }))).toThrow(/slug/i)
  })
})
```

- [ ] **Step 3.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test prisma/seed/__tests__/validate-content.spec.ts`

Expected: FAIL with "Cannot find module '../validate-content'".

- [ ] **Step 3.3: Create `apps/api/prisma/seed/validate-content.ts`**

```ts
import {
  applyAlgorithm,
  fromStickerString,
  parseAlgorithm,
  SOLVED_STATE,
  stateEquals,
} from '@rubik/cube-core'
import {
  CaseContentSchema,
  MethodContentSchema,
  PuzzleContentSchema,
  SetContentSchema,
  type CaseContent,
  type MethodContent,
  type PuzzleContent,
  type SetContent,
} from '@rubik/shared'

import type {
  ContentBundle,
  LoadedCase,
  LoadedMethod,
  LoadedPuzzle,
  LoadedSet,
} from './load-content'

export interface ValidatedPuzzle extends Omit<LoadedPuzzle, 'data'> {
  data: PuzzleContent
}
export interface ValidatedMethod extends Omit<LoadedMethod, 'data'> {
  data: MethodContent
}
export interface ValidatedSet extends Omit<LoadedSet, 'data'> {
  data: SetContent
}
export interface ValidatedCase extends Omit<LoadedCase, 'data'> {
  data: CaseContent
}

export interface ValidatedBundle {
  puzzles: ValidatedPuzzle[]
  methods: ValidatedMethod[]
  sets: ValidatedSet[]
  cases: ValidatedCase[]
}

const formatZodIssues = (filePath: string, issues: { path: (string | number)[]; message: string }[]): string => {
  const lines = issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  return `${filePath}:\n${lines.join('\n')}`
}

const parseOrThrow = <T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } } },
  filePath: string,
  data: unknown,
): T => {
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(formatZodIssues(filePath, result.error.issues))
  return result.data
}

const crossCheckCase = (filePath: string, c: CaseContent): void => {
  const primary = c.variants.find((v) => v.is_primary)
  if (!primary) {
    throw new Error(`${filePath}: case has no is_primary variant (schema should have caught this)`)
  }
  const initialState = fromStickerString(c.case_state)
  const moves = parseAlgorithm(primary.notation)
  const finalState = applyAlgorithm(initialState, moves)
  if (!stateEquals(finalState, SOLVED_STATE)) {
    throw new Error(
      `${filePath}: primary notation does not solve case_state (case=${c.slug}, alg="${primary.notation}")`,
    )
  }
}

export const validateContent = (bundle: ContentBundle): ValidatedBundle => {
  const validated: ValidatedBundle = { puzzles: [], methods: [], sets: [], cases: [] }

  for (const p of bundle.puzzles) {
    const data = parseOrThrow(PuzzleContentSchema, p.filePath, p.data)
    validated.puzzles.push({ filePath: p.filePath, data })
  }
  for (const m of bundle.methods) {
    const data = parseOrThrow(MethodContentSchema, m.filePath, m.data)
    validated.methods.push({ filePath: m.filePath, puzzleSlug: m.puzzleSlug, data })
  }
  for (const s of bundle.sets) {
    const data = parseOrThrow(SetContentSchema, s.filePath, s.data)
    validated.sets.push({
      filePath: s.filePath,
      puzzleSlug: s.puzzleSlug,
      methodSlug: s.methodSlug,
      data,
    })
  }
  for (const c of bundle.cases) {
    const data = parseOrThrow(CaseContentSchema, c.filePath, c.data)
    crossCheckCase(c.filePath, data)
    validated.cases.push({
      filePath: c.filePath,
      puzzleSlug: c.puzzleSlug,
      methodSlug: c.methodSlug,
      setSlug: c.setSlug,
      data,
    })
  }

  return validated
}
```

- [ ] **Step 3.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test prisma/seed/__tests__/validate-content.spec.ts`

Expected: PASS — 5 tests. The "primary notation does not solve case_state" test exercises the cube-core cross-check against the actual cube-core engine.

- [ ] **Step 3.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 3.6: Commit**

```bash
git add apps/api/prisma/seed/validate-content.ts apps/api/prisma/seed/__tests__/validate-content.spec.ts
git commit -m "$(cat <<'EOF'
feat(prisma): add validate-content with zod + cube-core cross-check

Each yaml file passes through its @rubik/shared schema; case files
additionally run primary-notation against case_state and require
SOLVED_STATE per §060. Failures throw with a precise file path and a
human-readable reason, fail-fast on the first error.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: upsert-content.ts — Prisma upserts in dependency order

**Files:**
- Create: `apps/api/prisma/seed/upsert-content.ts`
- Create: `apps/api/prisma/seed/__tests__/upsert-content.spec.ts`

`upsertContent(prisma, bundle, options)` writes the validated bundle to the DB in Puzzle → Method → Set → Case → Variant order. Variants are per-case `deleteMany + createMany` (no natural unique key). With `prune: true`, rows whose slug isn't in the bundle are deleted in reverse dep order (cascades clean up relations).

- [ ] **Step 4.1: Write the failing spec**

Create `apps/api/prisma/seed/__tests__/upsert-content.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ValidatedBundle } from '../validate-content'
import { upsertContent } from '../upsert-content'

const buildPrismaMock = () => ({
  puzzle: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  method: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  algorithmSet: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  algorithmCase: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  algorithmVariant: { deleteMany: vi.fn(), createMany: vi.fn() },
})

const buildBundle = (): ValidatedBundle => ({
  puzzles: [
    {
      filePath: '/p.yaml',
      data: {
        slug: '3x3',
        name: '3x3',
        display_name: '3x3 Cube',
        wca_event_code: '333',
        display_order: 0,
        state_schema_version: 'v1',
      },
    },
  ],
  methods: [
    {
      filePath: '/m.yaml',
      puzzleSlug: '3x3',
      data: { slug: 'cfop', name: 'CFOP', display_order: 0, description_md: null },
    },
  ],
  sets: [
    {
      filePath: '/s.yaml',
      puzzleSlug: '3x3',
      methodSlug: 'cfop',
      data: {
        slug: 'pll',
        name: 'PLL',
        display_name: null,
        case_count_expected: 21,
        recognition_basis: 'PLL_PERMUTATION',
        display_order: 2,
        description_md: null,
      },
    },
  ],
  cases: [
    {
      filePath: '/c.yaml',
      puzzleSlug: '3x3',
      methodSlug: 'cfop',
      setSlug: 'pll',
      data: {
        slug: 't-perm',
        name: 'T-Perm',
        display_name: 'T-Perm',
        display_order: 0,
        case_state: 'UUUUUUUUUFRFRRRRRRRFRFFFFFFDDDDDDDDDLBLLLLLLLBLBBBBBBB',
        recognition_md: null,
        tags: ['pll'],
        variants: [
          {
            notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
            is_primary: true,
            attribution: null,
            fingertrick_md: null,
            video_url: null,
          },
        ],
      },
    },
  ],
})

const compileService = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  prismaMock.puzzle.upsert.mockResolvedValue({ id: 'puz_1', slug: '3x3' })
  prismaMock.method.upsert.mockResolvedValue({ id: 'mth_1', slug: 'cfop' })
  prismaMock.algorithmSet.upsert.mockResolvedValue({ id: 'set_1', slug: 'pll' })
  prismaMock.algorithmCase.upsert.mockResolvedValue({ id: 'case_1', slug: 't-perm' })
  prismaMock.algorithmVariant.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.algorithmVariant.createMany.mockResolvedValue({ count: 1 })

  const moduleRef = await Test.createTestingModule({
    providers: [{ provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(PrismaService)
}

describe('upsertContent', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  it('upserts in Puzzle → Method → Set → Case → Variant order', async () => {
    const service = await compileService(prisma)
    const order: string[] = []
    prisma.puzzle.upsert.mockImplementationOnce(async () => {
      order.push('puzzle')
      return { id: 'puz_1', slug: '3x3' }
    })
    prisma.method.upsert.mockImplementationOnce(async () => {
      order.push('method')
      return { id: 'mth_1', slug: 'cfop' }
    })
    prisma.algorithmSet.upsert.mockImplementationOnce(async () => {
      order.push('set')
      return { id: 'set_1', slug: 'pll' }
    })
    prisma.algorithmCase.upsert.mockImplementationOnce(async () => {
      order.push('case')
      return { id: 'case_1', slug: 't-perm' }
    })
    prisma.algorithmVariant.deleteMany.mockImplementationOnce(async () => {
      order.push('variant.deleteMany')
      return { count: 0 }
    })
    prisma.algorithmVariant.createMany.mockImplementationOnce(async () => {
      order.push('variant.createMany')
      return { count: 1 }
    })

    await upsertContent(service, buildBundle(), { prune: false })

    expect(order).toEqual(['puzzle', 'method', 'set', 'case', 'variant.deleteMany', 'variant.createMany'])
  })

  it('replaces variants per case via deleteMany + createMany', async () => {
    const service = await compileService(prisma)

    await upsertContent(service, buildBundle(), { prune: false })

    expect(prisma.algorithmVariant.deleteMany).toHaveBeenCalledWith({ where: { caseId: 'case_1' } })
    expect(prisma.algorithmVariant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          caseId: 'case_1',
          notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
          isPrimary: true,
        }),
      ],
    })
  })

  it('does NOT delete orphan rows when prune is false', async () => {
    const service = await compileService(prisma)
    prisma.algorithmCase.findMany.mockResolvedValueOnce([
      { id: 'old_case', slug: 'old-case', setId: 'set_1' },
    ])

    await upsertContent(service, buildBundle(), { prune: false })

    expect(prisma.algorithmCase.deleteMany).not.toHaveBeenCalled()
    expect(prisma.algorithmSet.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes orphan rows when prune is true', async () => {
    const service = await compileService(prisma)
    prisma.algorithmCase.findMany.mockResolvedValueOnce([
      { id: 'orphan_case', slug: 'old-case', setId: 'set_1' },
      { id: 'case_1', slug: 't-perm', setId: 'set_1' },
    ])

    await upsertContent(service, buildBundle(), { prune: true })

    expect(prisma.algorithmCase.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['orphan_case'] } },
    })
  })
})
```

- [ ] **Step 4.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test prisma/seed/__tests__/upsert-content.spec.ts`

Expected: FAIL with "Cannot find module '../upsert-content'".

- [ ] **Step 4.3: Create `apps/api/prisma/seed/upsert-content.ts`**

```ts
import type { PrismaService } from 'nestjs-prisma'

import type {
  ValidatedBundle,
  ValidatedCase,
  ValidatedMethod,
  ValidatedSet,
} from './validate-content'

export interface UpsertOptions {
  prune: boolean
}

export interface UpsertResult {
  puzzles: { upserted: number; pruned: number }
  methods: { upserted: number; pruned: number }
  sets: { upserted: number; pruned: number }
  cases: { upserted: number; pruned: number }
  variants: { written: number }
}

const upsertPuzzles = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
): Promise<Map<string, string>> => {
  const slugToId = new Map<string, string>()
  for (const p of bundle.puzzles) {
    const row = await prisma.puzzle.upsert({
      where: { slug: p.data.slug },
      create: {
        slug: p.data.slug,
        name: p.data.name,
        displayName: p.data.display_name,
        wcaEventCode: p.data.wca_event_code ?? null,
        displayOrder: p.data.display_order,
        stateSchemaVersion: p.data.state_schema_version,
      },
      update: {
        name: p.data.name,
        displayName: p.data.display_name,
        wcaEventCode: p.data.wca_event_code ?? null,
        displayOrder: p.data.display_order,
        stateSchemaVersion: p.data.state_schema_version,
      },
      select: { id: true, slug: true },
    })
    slugToId.set(row.slug, row.id)
  }
  return slugToId
}

const upsertMethods = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  puzzleIds: Map<string, string>,
): Promise<Map<string, string>> => {
  const slugToId = new Map<string, string>()
  for (const m of bundle.methods) {
    const puzzleId = puzzleIds.get(m.puzzleSlug)
    if (!puzzleId) throw new Error(`${m.filePath}: parent puzzle "${m.puzzleSlug}" not found in bundle`)
    const row = await prisma.method.upsert({
      where: { puzzleId_slug: { puzzleId, slug: m.data.slug } },
      create: {
        puzzleId,
        slug: m.data.slug,
        name: m.data.name,
        displayOrder: m.data.display_order,
        descriptionMd: m.data.description_md ?? null,
      },
      update: {
        name: m.data.name,
        displayOrder: m.data.display_order,
        descriptionMd: m.data.description_md ?? null,
      },
      select: { id: true, slug: true },
    })
    slugToId.set(`${m.puzzleSlug}/${row.slug}`, row.id)
  }
  return slugToId
}

const upsertSets = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  methodIds: Map<string, string>,
): Promise<Map<string, string>> => {
  const slugToId = new Map<string, string>()
  for (const s of bundle.sets) {
    const methodId = methodIds.get(`${s.puzzleSlug}/${s.methodSlug}`)
    if (!methodId) throw new Error(`${s.filePath}: parent method "${s.methodSlug}" not found in bundle`)
    const row = await prisma.algorithmSet.upsert({
      where: { methodId_slug: { methodId, slug: s.data.slug } },
      create: {
        methodId,
        slug: s.data.slug,
        name: s.data.name,
        caseCountExpected: s.data.case_count_expected,
        recognitionBasis: s.data.recognition_basis,
        displayOrder: s.data.display_order,
        descriptionMd: s.data.description_md ?? null,
      },
      update: {
        name: s.data.name,
        caseCountExpected: s.data.case_count_expected,
        recognitionBasis: s.data.recognition_basis,
        displayOrder: s.data.display_order,
        descriptionMd: s.data.description_md ?? null,
      },
      select: { id: true, slug: true },
    })
    slugToId.set(`${s.puzzleSlug}/${s.methodSlug}/${row.slug}`, row.id)
  }
  return slugToId
}

const upsertCasesAndVariants = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  setIds: Map<string, string>,
): Promise<{ caseIds: Map<string, string>; variantsWritten: number }> => {
  const caseIds = new Map<string, string>()
  let variantsWritten = 0

  for (const c of bundle.cases) {
    const setId = setIds.get(`${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}`)
    if (!setId) throw new Error(`${c.filePath}: parent set "${c.setSlug}" not found in bundle`)

    const row = await prisma.algorithmCase.upsert({
      where: { setId_slug: { setId, slug: c.data.slug } },
      create: {
        setId,
        slug: c.data.slug,
        name: c.data.name,
        displayName: c.data.display_name,
        displayOrder: c.data.display_order,
        caseState: c.data.case_state.replace(/\s+/g, ''),
        recognitionMd: c.data.recognition_md ?? null,
        tags: c.data.tags ?? [],
      },
      update: {
        name: c.data.name,
        displayName: c.data.display_name,
        displayOrder: c.data.display_order,
        caseState: c.data.case_state.replace(/\s+/g, ''),
        recognitionMd: c.data.recognition_md ?? null,
        tags: c.data.tags ?? [],
      },
      select: { id: true, slug: true },
    })
    caseIds.set(`${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}/${row.slug}`, row.id)

    await prisma.algorithmVariant.deleteMany({ where: { caseId: row.id } })
    const created = await prisma.algorithmVariant.createMany({
      data: c.data.variants.map((v) => ({
        caseId: row.id,
        notation: v.notation,
        isPrimary: v.is_primary,
        attribution: v.attribution ?? null,
        fingertrickMd: v.fingertrick_md ?? null,
      })),
    })
    variantsWritten += created.count
  }

  return { caseIds, variantsWritten }
}

const pruneOrphans = async (
  prisma: PrismaService,
  caseIds: Map<string, string>,
  setIds: Map<string, string>,
  methodIds: Map<string, string>,
  puzzleIds: Map<string, string>,
): Promise<{ cases: number; sets: number; methods: number; puzzles: number }> => {
  const presentCaseIds = new Set(caseIds.values())
  const presentSetIds = new Set(setIds.values())
  const presentMethodIds = new Set(methodIds.values())
  const presentPuzzleIds = new Set(puzzleIds.values())

  const allCases = await prisma.algorithmCase.findMany({ select: { id: true } })
  const orphanCases = allCases.filter((c) => !presentCaseIds.has(c.id)).map((c) => c.id)
  if (orphanCases.length > 0) {
    await prisma.algorithmCase.deleteMany({ where: { id: { in: orphanCases } } })
  }

  const allSets = await prisma.algorithmSet.findMany({ select: { id: true } })
  const orphanSets = allSets.filter((s) => !presentSetIds.has(s.id)).map((s) => s.id)
  if (orphanSets.length > 0) {
    await prisma.algorithmSet.deleteMany({ where: { id: { in: orphanSets } } })
  }

  const allMethods = await prisma.method.findMany({ select: { id: true } })
  const orphanMethods = allMethods.filter((m) => !presentMethodIds.has(m.id)).map((m) => m.id)
  if (orphanMethods.length > 0) {
    await prisma.method.deleteMany({ where: { id: { in: orphanMethods } } })
  }

  const allPuzzles = await prisma.puzzle.findMany({ select: { id: true } })
  const orphanPuzzles = allPuzzles.filter((p) => !presentPuzzleIds.has(p.id)).map((p) => p.id)
  if (orphanPuzzles.length > 0) {
    await prisma.puzzle.deleteMany({ where: { id: { in: orphanPuzzles } } })
  }

  return {
    cases: orphanCases.length,
    sets: orphanSets.length,
    methods: orphanMethods.length,
    puzzles: orphanPuzzles.length,
  }
}

export const upsertContent = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  options: UpsertOptions,
): Promise<UpsertResult> => {
  const puzzleIds = await upsertPuzzles(prisma, bundle)
  const methodIds = await upsertMethods(prisma, bundle, puzzleIds)
  const setIds = await upsertSets(prisma, bundle, methodIds)
  const { caseIds, variantsWritten } = await upsertCasesAndVariants(prisma, bundle, setIds)

  let pruned = { cases: 0, sets: 0, methods: 0, puzzles: 0 }
  if (options.prune) {
    pruned = await pruneOrphans(prisma, caseIds, setIds, methodIds, puzzleIds)
  }

  return {
    puzzles: { upserted: puzzleIds.size, pruned: pruned.puzzles },
    methods: { upserted: methodIds.size, pruned: pruned.methods },
    sets: { upserted: setIds.size, pruned: pruned.sets },
    cases: { upserted: caseIds.size, pruned: pruned.cases },
    variants: { written: variantsWritten },
  }
}
```

- [ ] **Step 4.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test prisma/seed/__tests__/upsert-content.spec.ts`

Expected: PASS — 4 tests.

- [ ] **Step 4.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/prisma/seed/upsert-content.ts apps/api/prisma/seed/__tests__/upsert-content.spec.ts
git commit -m "$(cat <<'EOF'
feat(prisma): add upsert-content for dependency-ordered seed writes

Upserts Puzzle → Method → Set → Case → Variant on the natural unique
keys (slug, composite parentId+slug). Variants per-case use
deleteMany + createMany since they have no natural unique key. The
prune option deletes rows whose ids aren't in the bundle, in
reverse-cascade order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: seed.ts — CLI entry

**Files:**
- Create: `apps/api/prisma/seed.ts`

The seed script Prisma calls. Resolves the repo root, loads + validates + (optionally) upserts content. CLI flags: `--validate-only`, `--dry-run`, `--prune`. Bare invocation = full seed (idempotent).

- [ ] **Step 5.1: Create `apps/api/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadContent } from './seed/load-content'
import { upsertContent } from './seed/upsert-content'
import { validateContent } from './seed/validate-content'

interface ParsedFlags {
  validateOnly: boolean
  dryRun: boolean
  prune: boolean
}

const parseFlags = (argv: string[]): ParsedFlags => ({
  validateOnly: argv.includes('--validate-only'),
  dryRun: argv.includes('--dry-run'),
  prune: argv.includes('--prune'),
})

const resolveContentRoot = (): string => {
  const here = fileURLToPath(new URL('.', import.meta.url))
  return resolve(here, '..', '..', '..', 'content')
}

const main = async () => {
  const flags = parseFlags(process.argv.slice(2))
  const contentRoot = resolveContentRoot()

  console.log(`[seed] reading from ${contentRoot}`)
  const bundle = await loadContent(contentRoot)
  console.log(
    `[seed] loaded ${bundle.puzzles.length} puzzles, ${bundle.methods.length} methods, ${bundle.sets.length} sets, ${bundle.cases.length} cases`,
  )

  const validated = validateContent(bundle)
  console.log(`[seed] validated all content (zod + cube-core cross-check)`)

  if (flags.validateOnly) {
    console.log(`[seed] --validate-only set; not writing to DB`)
    return
  }

  if (flags.dryRun) {
    console.log(
      `[seed] --dry-run set; would upsert ${validated.puzzles.length}+${validated.methods.length}+${validated.sets.length}+${validated.cases.length} rows; not writing`,
    )
    return
  }

  const prisma = new PrismaClient()
  try {
    const result = await upsertContent(prisma, validated, { prune: flags.prune })
    console.log(`[seed] ${JSON.stringify(result)}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
```

(Yes — `seed.ts` instantiates `PrismaClient` directly, NOT `nestjs-prisma`'s `PrismaService`. Prisma's `db seed` runs outside Nest DI; one direct client is correct here. The `upsertContent` function takes the `PrismaService` *type* but the runtime methods used are identical between `PrismaClient` and `PrismaService`.)

- [ ] **Step 5.2: Adjust `upsertContent` to accept either `PrismaClient` or `PrismaService`**

Edit `apps/api/prisma/seed/upsert-content.ts`. Change the import:

```ts
import type { PrismaService } from 'nestjs-prisma'
```

to:

```ts
import type { PrismaClient } from '@prisma/client'

type SeedPrisma = PrismaClient
```

Then change every occurrence of `prisma: PrismaService` in this file to `prisma: SeedPrisma`. (There are 7: the function signatures of `upsertPuzzles`, `upsertMethods`, `upsertSets`, `upsertCasesAndVariants`, `pruneOrphans`, the exported `upsertContent`, and the JSDoc/types if any.)

The spec was written against `PrismaService` from `nestjs-prisma` because `nestjs-prisma`'s service extends `PrismaClient`. Shape is identical at runtime; the spec keeps working.

Actually update the spec import too: `apps/api/prisma/seed/__tests__/upsert-content.spec.ts` — change `import { PrismaService } from 'nestjs-prisma'` to `import { PrismaClient } from '@prisma/client'`, and change `{ provide: PrismaService, useValue: prismaMock }` to `{ provide: PrismaClient, useValue: prismaMock }`. Update the `moduleRef.get(PrismaService)` to `moduleRef.get(PrismaClient)`.

- [ ] **Step 5.3: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 5.4: Re-run all seed specs**

Run: `pnpm --filter @rubik/api test prisma/seed`

Expected: all 11 tests pass (2 + 5 + 4).

- [ ] **Step 5.5: Confirm full api suite still green**

Run: `pnpm --filter @rubik/api test`

Expected: 51 + 11 = 62 tests pass across 15 files.

- [ ] **Step 5.6: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/prisma/seed/upsert-content.ts apps/api/prisma/seed/__tests__/upsert-content.spec.ts
git commit -m "$(cat <<'EOF'
feat(prisma): add seed.ts cli entry and rebase upsert on PrismaClient

Wires load → validate → upsert into a single CLI with --validate-only,
--dry-run, --prune flags. Runs as `tsx prisma/seed.ts` per the
package.json prisma.seed config from the previous commit. upsert-content
now types its prisma argument as PrismaClient so the seed script can
instantiate the client directly without going through Nest DI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Author puzzle.yaml + method.yaml + 3 set.yaml files

**Files:**
- Create: `content/puzzles/3x3/puzzle.yaml`
- Create: `content/puzzles/3x3/methods/cfop/method.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/f2l/set.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/oll/set.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/pll/set.yaml`

The non-case content metadata. No cases yet — we want to verify pipeline runs cleanly against an empty-cases tree first.

- [ ] **Step 6.1: Create `content/puzzles/3x3/puzzle.yaml`**

```yaml
slug: 3x3
name: 3x3
display_name: 3x3 Cube
wca_event_code: "333"
display_order: 0
state_schema_version: v1
```

- [ ] **Step 6.2: Create `content/puzzles/3x3/methods/cfop/method.yaml`**

```yaml
slug: cfop
name: CFOP
display_order: 0
description_md: null
```

- [ ] **Step 6.3: Create `content/puzzles/3x3/methods/cfop/sets/f2l/set.yaml`**

```yaml
slug: f2l
name: F2L
display_name: First Two Layers
case_count_expected: 41
recognition_basis: F2L_SLOT
display_order: 0
description_md: null
```

- [ ] **Step 6.4: Create `content/puzzles/3x3/methods/cfop/sets/oll/set.yaml`**

```yaml
slug: oll
name: OLL
display_name: Orientation of the Last Layer
case_count_expected: 57
recognition_basis: OLL_ORIENTATION
display_order: 1
description_md: null
```

- [ ] **Step 6.5: Create `content/puzzles/3x3/methods/cfop/sets/pll/set.yaml`**

```yaml
slug: pll
name: PLL
display_name: Permutation of the Last Layer
case_count_expected: 21
recognition_basis: PLL_PERMUTATION
display_order: 2
description_md: null
```

- [ ] **Step 6.6: Validate**

Run: `make content.validate`

Expected output (paraphrased): `[seed] reading from .../content`, `[seed] loaded 1 puzzles, 1 methods, 3 sets, 0 cases`, `[seed] validated all content`, `[seed] --validate-only set; not writing to DB`. Exit 0.

- [ ] **Step 6.7: Commit**

```bash
git add content/puzzles/3x3/puzzle.yaml content/puzzles/3x3/methods/cfop/method.yaml content/puzzles/3x3/methods/cfop/sets/
git commit -m "$(cat <<'EOF'
content(catalog): add 3x3 puzzle, cfop method, and f2l/oll/pll sets

Catalog metadata only — no case files yet. Each set declares the
recognition_basis enum value used by the api's catalog endpoints
and downstream visualizer to choose the right rendering.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Author 3 F2L cases (f2l-1, f2l-2, f2l-3)

**Files:**
- Create: `content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-1.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-2.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-3.yaml`

The three simplest F2L cases per `F2L_ALGORITHMS` in `packages/cube-core/src/recognition/f2l.ts`: `F2L1`, `F2L2`, `F2L3`. Each has a tiny algorithm. We compute the canonical case_state via cube-core.

- [ ] **Step 7.1: Compute case_state values**

Run from the repo root:

```bash
pnpm --filter @rubik/api tsx -e "
import {
  F2L_ALGORITHMS,
  applyAlgorithm,
  invertAlgorithm,
  parseAlgorithm,
  toStickerString,
  SOLVED_STATE,
} from '@rubik/cube-core'

for (const id of ['F2L1', 'F2L2', 'F2L3']) {
  const alg = F2L_ALGORITHMS[id]
  const moves = parseAlgorithm(alg)
  const state = applyAlgorithm(SOLVED_STATE, invertAlgorithm(moves))
  console.log(id, '|', alg, '|', toStickerString(state))
}
"
```

Expected: three lines, each with the case id, the algorithm, and the 54-char sticker string. Copy each `<state>` for use below.

- [ ] **Step 7.2: Create `content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-1.yaml`**

```yaml
slug: f2l-1
name: F2L 1
display_name: F2L 1 (basic insert, slot empty)
display_order: 0
case_state: "<paste F2L1 state from step 7.1>"
recognition_md: |
  Corner+edge pair already aligned in the U-layer; insert into the FR slot via U R U' R'.
tags:
  - f2l
  - basic
variants:
  - notation: "U R U' R'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 7.3: Create `content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-2.yaml`**

```yaml
slug: f2l-2
name: F2L 2
display_name: F2L 2 (mirror of F2L 1)
display_order: 1
case_state: "<paste F2L2 state from step 7.1>"
recognition_md: |
  Mirror of F2L 1 — corner+edge pair aligned on the L side; insert via y U' L' U L y'.
tags:
  - f2l
  - basic
  - mirror
variants:
  - notation: "y U' L' U L y'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 7.4: Create `content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-3.yaml`**

```yaml
slug: f2l-3
name: F2L 3
display_name: F2L 3 (basic insert, slot empty, second variant)
display_order: 2
case_state: "<paste F2L3 state from step 7.1>"
recognition_md: |
  Corner+edge pair adjacent on U-layer with edge above target slot; insert via U' R U R'.
tags:
  - f2l
  - basic
variants:
  - notation: "U' R U R'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 7.5: Validate**

Run: `make content.validate`

Expected: `[seed] loaded 1 puzzles, 1 methods, 3 sets, 3 cases`, validation passes. Exit 0.

If a case fails the cube-core cross-check, the case_state value is wrong — re-run step 7.1 and re-paste.

- [ ] **Step 7.6: Commit**

```bash
git add content/puzzles/3x3/methods/cfop/sets/f2l/cases/
git commit -m "$(cat <<'EOF'
content(f2l): add f2l-1, f2l-2, f2l-3 cases

Three smallest F2L cases — simple corner+edge slot inserts. Algorithms
sourced from cube-core's F2L_ALGORITHMS table; case_state values
derived from those algorithms via inverse-applied-to-solved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Author 3 OLL cases (sune, anti-sune, h-oll)

**Files:**
- Create: `content/puzzles/3x3/methods/cfop/sets/oll/cases/sune.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/oll/cases/anti-sune.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/oll/cases/h-oll.yaml`

Three well-known OLLs from `OLL_ALGORITHMS`: `OLL27` (Sune), `OLL26` (Anti-Sune), `OLL21` (H).

- [ ] **Step 8.1: Compute case_state values**

```bash
pnpm --filter @rubik/api tsx -e "
import {
  OLL_ALGORITHMS,
  applyAlgorithm,
  invertAlgorithm,
  parseAlgorithm,
  toStickerString,
  SOLVED_STATE,
} from '@rubik/cube-core'

for (const id of ['OLL27', 'OLL26', 'OLL21']) {
  const alg = OLL_ALGORITHMS[id]
  const moves = parseAlgorithm(alg)
  const state = applyAlgorithm(SOLVED_STATE, invertAlgorithm(moves))
  console.log(id, '|', alg, '|', toStickerString(state))
}
"
```

- [ ] **Step 8.2: Create `content/puzzles/3x3/methods/cfop/sets/oll/cases/sune.yaml`**

```yaml
slug: sune
name: Sune
display_name: Sune (OLL 27)
display_order: 0
case_state: "<paste OLL27 state from step 8.1>"
recognition_md: |
  Three corners oriented; one corner twisted clockwise. The FRU corner faces forward.
tags:
  - oll
  - corner-orientation
variants:
  - notation: "R U R' U R U2 R'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 8.3: Create `content/puzzles/3x3/methods/cfop/sets/oll/cases/anti-sune.yaml`**

```yaml
slug: anti-sune
name: Anti-Sune
display_name: Anti-Sune (OLL 26)
display_order: 1
case_state: "<paste OLL26 state from step 8.1>"
recognition_md: |
  Mirror of Sune — three corners oriented; one corner twisted counter-clockwise.
tags:
  - oll
  - corner-orientation
  - mirror
variants:
  - notation: "R U2 R' U' R U' R'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 8.4: Create `content/puzzles/3x3/methods/cfop/sets/oll/cases/h-oll.yaml`**

```yaml
slug: h-oll
name: H
display_name: H (OLL 21)
display_order: 2
case_state: "<paste OLL21 state from step 8.1>"
recognition_md: |
  All four corners twisted; symmetric "H" pattern of yellow stickers on the U face.
tags:
  - oll
  - corner-orientation
  - symmetric
variants:
  - notation: "R U2 R' U' R U R' U' R U' R'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

(Slug `h-oll` instead of `h` to disambiguate from a future H-Perm in PLL — the slug must be unique within its set, but cross-set ambiguity in the URL hierarchy invites copy-paste mistakes.)

- [ ] **Step 8.5: Validate**

Run: `make content.validate`

Expected: `[seed] loaded 1 puzzles, 1 methods, 3 sets, 6 cases`, validation passes.

- [ ] **Step 8.6: Commit**

```bash
git add content/puzzles/3x3/methods/cfop/sets/oll/cases/
git commit -m "$(cat <<'EOF'
content(oll): add sune, anti-sune, h-oll cases

Three well-known OLLs — Sune (OLL27), Anti-Sune (OLL26), H (OLL21).
Algorithms sourced from cube-core's OLL_ALGORITHMS; case_state
values derived from those algorithms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Author 3 PLL cases (t-perm, aa-perm, ab-perm)

**Files:**
- Create: `content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/pll/cases/aa-perm.yaml`
- Create: `content/puzzles/3x3/methods/cfop/sets/pll/cases/ab-perm.yaml`

The plan-required PLLs: T-Perm + Aa-Perm + Ab-Perm. From `PLL_ALGORITHMS`: `T`, `Aa`, `Ab`.

- [ ] **Step 9.1: Compute case_state values**

```bash
pnpm --filter @rubik/api tsx -e "
import {
  PLL_ALGORITHMS,
  applyAlgorithm,
  invertAlgorithm,
  parseAlgorithm,
  toStickerString,
  SOLVED_STATE,
} from '@rubik/cube-core'

for (const id of ['T', 'Aa', 'Ab']) {
  const alg = PLL_ALGORITHMS[id]
  const moves = parseAlgorithm(alg)
  const state = applyAlgorithm(SOLVED_STATE, invertAlgorithm(moves))
  console.log(id, '|', alg, '|', toStickerString(state))
}
"
```

- [ ] **Step 9.2: Create `content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml`**

```yaml
slug: t-perm
name: T-Perm
display_name: T-Perm
display_order: 0
case_state: "<paste T state from step 9.1>"
recognition_md: |
  Two adjacent yellow headlights on F; bar of three same-color stickers on the L face;
  the other two faces show the classic T-perm 2-corner-2-edge swap pattern.
tags:
  - pll
  - edge-corner-3-cycle
variants:
  - notation: "R U R' U' R' F R2 U' R' U' R U R' F'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 9.3: Create `content/puzzles/3x3/methods/cfop/sets/pll/cases/aa-perm.yaml`**

```yaml
slug: aa-perm
name: Aa-Perm
display_name: Aa-Perm
display_order: 1
case_state: "<paste Aa state from step 9.1>"
recognition_md: |
  Three-corner cycle clockwise (looking from U). All edges already permuted.
tags:
  - pll
  - corner-3-cycle
variants:
  - notation: "x R' U R' D2 R U' R' D2 R2 x'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 9.4: Create `content/puzzles/3x3/methods/cfop/sets/pll/cases/ab-perm.yaml`**

```yaml
slug: ab-perm
name: Ab-Perm
display_name: Ab-Perm
display_order: 2
case_state: "<paste Ab state from step 9.1>"
recognition_md: |
  Mirror of Aa — three-corner cycle counter-clockwise (looking from U).
tags:
  - pll
  - corner-3-cycle
  - mirror
variants:
  - notation: "x R2 D2 R U R' D2 R U' R x'"
    is_primary: true
    attribution: null
    fingertrick_md: null
    video_url: null
```

- [ ] **Step 9.5: Validate**

Run: `make content.validate`

Expected: `[seed] loaded 1 puzzles, 1 methods, 3 sets, 9 cases`, validation passes.

- [ ] **Step 9.6: Commit**

```bash
git add content/puzzles/3x3/methods/cfop/sets/pll/cases/
git commit -m "$(cat <<'EOF'
content(pll): add t-perm, aa-perm, ab-perm cases

Plan-06-required PLLs: T-Perm + at least one A-Perm. We ship both
A-Perm directions (Aa + Ab) for symmetry. Algorithms sourced from
cube-core's PLL_ALGORITHMS; case_state values derived from those
algorithms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Mirror fixtures under content/fixtures/

**Files:**
- Create: `content/fixtures/puzzles/3x3/puzzle.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/method.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/set.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-1.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-2.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/oll/set.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/oll/cases/sune.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/oll/cases/anti-sune.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/pll/set.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml`
- Create: `content/fixtures/puzzles/3x3/methods/cfop/sets/pll/cases/aa-perm.yaml`

Subset for future api integration tests + web component tests. PLL fixtures must include T-Perm. We mirror 2 cases per set (6 total).

- [ ] **Step 10.1: Copy puzzle.yaml + method.yaml into fixtures**

```bash
mkdir -p content/fixtures/puzzles/3x3/methods/cfop
cp content/puzzles/3x3/puzzle.yaml content/fixtures/puzzles/3x3/puzzle.yaml
cp content/puzzles/3x3/methods/cfop/method.yaml content/fixtures/puzzles/3x3/methods/cfop/method.yaml
```

- [ ] **Step 10.2: Copy each set.yaml + 2 case yamls per set**

```bash
mkdir -p content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/cases
cp content/puzzles/3x3/methods/cfop/sets/f2l/set.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/set.yaml
cp content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-1.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-1.yaml
cp content/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-2.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/f2l/cases/f2l-2.yaml

mkdir -p content/fixtures/puzzles/3x3/methods/cfop/sets/oll/cases
cp content/puzzles/3x3/methods/cfop/sets/oll/set.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/oll/set.yaml
cp content/puzzles/3x3/methods/cfop/sets/oll/cases/sune.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/oll/cases/sune.yaml
cp content/puzzles/3x3/methods/cfop/sets/oll/cases/anti-sune.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/oll/cases/anti-sune.yaml

mkdir -p content/fixtures/puzzles/3x3/methods/cfop/sets/pll/cases
cp content/puzzles/3x3/methods/cfop/sets/pll/set.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/pll/set.yaml
cp content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml
cp content/puzzles/3x3/methods/cfop/sets/pll/cases/aa-perm.yaml content/fixtures/puzzles/3x3/methods/cfop/sets/pll/cases/aa-perm.yaml
```

- [ ] **Step 10.3: Verify fixtures aren't mistakenly picked up by `make content.validate`**

The validator points at `content/` (NOT `content/fixtures/`). Verify by running `make content.validate` — case count should still be 9, not 15.

If the fixture files are getting walked, the resolveContentRoot logic in `seed.ts` is wrong — `loadContent` walks anything under the resolved root. Since `content/fixtures/puzzles/...` lives under the same `content/` root, fixtures WILL be walked and counted with real content. **This is a problem.** The fix: change the seed.ts to skip a `fixtures` subdirectory at the puzzles level, OR move the fixtures to `content/fixtures/puzzles/...` and have loadContent NOT walk a `fixtures` directory.

Solution chosen: edit `apps/api/prisma/seed/load-content.ts` to skip any directory named `fixtures` at the top level. Find the `for (const puzzleSlug of await listSubdirs(puzzlesDir))` loop and `continue` if `puzzleSlug === 'fixtures'`. **But fixtures live at `content/fixtures/`, not `content/puzzles/fixtures/`.** Re-read the layout:

```
content/
├── puzzles/3x3/...
└── fixtures/
    └── puzzles/3x3/...
```

`loadContent` walks `<root>/puzzles/...` only. `<root>/fixtures` is NOT under `<root>/puzzles`. So fixtures are NOT walked by default — the `puzzlesDir = join(rootDir, 'puzzles')` check sandboxes us correctly.

**Verify by running `make content.validate` — should still be 9 cases.** If it picks up more than 9, escalate to the controller.

- [ ] **Step 10.4: Commit**

```bash
git add content/fixtures/
git commit -m "$(cat <<'EOF'
content(fixtures): mirror tiny subset under content/fixtures/

Two cases per set (f2l-1+f2l-2, sune+anti-sune, t-perm+aa-perm) plus
the puzzle/method/set metadata. Used by future api integration tests
(Testcontainers, deferred) and web component tests (plan 07). Real
content seed doesn't walk this tree — loadContent only follows
content/puzzles/, leaving content/fixtures/ untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual smoke checklist

This task does not produce a commit. It validates the end-to-end pipeline + content + api round-trip per the design's smoke checklist.

- [ ] **Step 11.1: Run validate-only against authored content**

Run: `make content.validate`

Expected: 9 cases loaded, all validate, exit 0.

- [ ] **Step 11.2: Verify a deliberately broken alg fails fast**

```bash
# Save original
cp content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml /tmp/t-perm.original.yaml

# Corrupt the algorithm — replace one move
sed -i "s|R U R' U' R' F R2 U' R' U' R U R' F'|R U R' U' R' F R2 U' R' U' R U R'|" content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml

# Validate — expect failure
make content.validate
# Expected: error like "primary notation does not solve case_state (case=t-perm, alg=...)"; exit 1

# Restore
cp /tmp/t-perm.original.yaml content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml
rm /tmp/t-perm.original.yaml
```

- [ ] **Step 11.3: Reset DB and seed fresh**

Run: `make db.reset` (drops + recreates + reseeds local DB)

Expected: Prisma applies all migrations; reseed runs `prisma db seed` which invokes `tsx prisma/seed.ts`. Output ends with the JSON summary `{"puzzles":{"upserted":1,...},"cases":{"upserted":9,...},"variants":{"written":9}}`.

- [ ] **Step 11.4: Verify idempotency**

Run: `make db.seed` again

Expected: same JSON summary — no Prisma errors. Re-run produces identical state (Prisma upserts are no-ops when data is unchanged; variants are deleteMany+createMany so they DO churn but resulting state is identical).

- [ ] **Step 11.5: Boot api and curl**

```bash
pnpm --filter @rubik/api dev > /tmp/api.log 2>&1 &
DEV_PID=$!
sleep 8

echo "=== /v1/puzzles ==="
curl -s http://localhost:3001/v1/puzzles | jq .

echo "=== /v1/puzzles/3x3/methods ==="
curl -s http://localhost:3001/v1/puzzles/3x3/methods | jq .

echo "=== /v1/puzzles/3x3/methods/cfop/sets ==="
curl -s http://localhost:3001/v1/puzzles/3x3/methods/cfop/sets | jq .

echo "=== /v1/sets/pll ==="
curl -s http://localhost:3001/v1/sets/pll | jq .

echo "=== /v1/cases/t-perm ==="
curl -s http://localhost:3001/v1/cases/t-perm | jq .

kill $DEV_PID 2>/dev/null || true
wait 2>/dev/null || true
```

Expected:
- `/v1/puzzles` → array with one puzzle (`{ slug: "3x3", name: "3x3", ... }`)
- `/v1/puzzles/3x3/methods` → array with one method (`cfop`)
- `/v1/puzzles/3x3/methods/cfop/sets` → array with three sets (f2l, oll, pll)
- `/v1/sets/pll` → set with `cases` array containing 3 cases (t-perm, aa-perm, ab-perm)
- `/v1/cases/t-perm` → case object with `variants` array containing the primary T-Perm notation

Body shapes match the `@rubik/shared` schemas. `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400` on every response.

If any output is empty / 404, the seed didn't write — check `make db.studio` to see what's in Postgres.

- [ ] **Step 11.6: Run full api suite to confirm no regressions**

Run: `pnpm --filter @rubik/api test`

Expected: 62 tests pass (51 from sub-phase 4 + 11 new from this plan's pipeline tests).

- [ ] **Step 11.7: Lint + typecheck across the api**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api lint`

Expected: clean.

If any step fails, do not close the sub-phase. Open a follow-up commit with the fix.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

Run: `git log --oneline plan-06-content-seed -15`

Expected (newest first):
```
<hash> content(fixtures): mirror tiny subset under content/fixtures/
<hash> content(pll): add t-perm, aa-perm, ab-perm cases
<hash> content(oll): add sune, anti-sune, h-oll cases
<hash> content(f2l): add f2l-1, f2l-2, f2l-3 cases
<hash> content(catalog): add 3x3 puzzle, cfop method, and f2l/oll/pll sets
<hash> feat(prisma): add seed.ts cli entry and rebase upsert on PrismaClient
<hash> feat(prisma): add upsert-content for dependency-ordered seed writes
<hash> feat(prisma): add validate-content with zod + cube-core cross-check
<hash> feat(prisma): add load-content for recursive yaml walk
<hash> chore(tooling): add tsx + js-yaml deps and prisma.seed config
6c374e9 docs(plans): add content-seed design for plan 06
771d610 fix(me): align UserAlgorithm wire shape with @rubik/shared schema
...
```

- [ ] **Step F.2: Confirm full quality gates**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api lint && pnpm --filter @rubik/api test`

Expected: all green.

- [ ] **Step F.3: Done-when checklist (paste into PR description)**

```
- [x] apps/api/prisma/seed.ts + apps/api/prisma/seed/{load,validate,upsert}-content.ts exist; unit tests pass
- [x] tsx, js-yaml, @types/js-yaml added to apps/api/package.json; prisma.seed config wired
- [x] content/puzzles/3x3/{puzzle.yaml, methods/cfop/{method.yaml, sets/{f2l,oll,pll}/{set.yaml, cases/<3>.yaml}}} authored — 9 case files
- [x] content/fixtures/puzzles/3x3/methods/cfop/sets/{f2l,oll,pll}/{set.yaml, cases/<2>.yaml} authored — 6 case files
- [x] make content.validate passes against authored content
- [x] make db.seed is idempotent
- [x] make content.validate fails fast and clearly on a deliberately-broken alg
- [x] Smoke checklist 11.1-11.5 verified locally
- [x] pnpm typecheck && pnpm lint && pnpm test clean across the api package
- [x] Commits follow lowercase Conventional Commits with scope `prisma`, `tooling`, `content`
```

---

## Out of scope (do not implement)

- Full 119-case CFOP corpus
- Recognition images / rich `recognition_md` (current copy is minimal)
- `apps/api/scripts/content-lint.ts` (Makefile target stays broken; defer)
- Testcontainers integration tests over the seeded DB
- `make case.compute` author helper
- Localization
- Live `PUT /v1/me/algorithms/t-perm` round-trip (now possible with seeded data + valid Google ID token; deferred to a manual verification when credentials are handy)
