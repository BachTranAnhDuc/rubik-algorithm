# Web Sub-Phase 7d Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the minimal-WCA timer (general + per-case) and the SEO bag (sitemap, robots, JSON-LD, dynamic OG image). Wire the case page to the timer via a "Time this case →" CTA. Defer `/embed/visualizer` to a later sub-phase per the 7d design (plan 04b is not yet shipped).

**Architecture:** Three orthogonal slices:

1. **Timer feature** — pure utils (format + stats), zustand store with persist middleware, TanStack Query scramble hook, presentation components, `/timer` page.
2. **Case-page CTA** — single link added next to `<TrackCaseButton />`.
3. **SEO bag** — `lib/jsonld.ts` + `lib/notation-prose.ts` helpers, JSON-LD script in case page, `app/sitemap.ts`, `app/robots.ts`, dynamic `opengraph-image.tsx` per case.

The timer slice has no dep on SEO and vice versa; either could land first. The plan sequences timer → CTA → SEO so the user-visible feature ships earliest.

**Tech Stack:** Next.js 15 + React 19 + zustand 5 (persist middleware) + TanStack Query 5 + `@rubik/visualizer/ssr` (SVG only) + existing shadcn primitives (button). No new dependencies.

**Test note:** `apps/web` has no vitest config today (per the 7c precedent). Timer pure utilities are simple enough to verify by manual smoke + typecheck. Vitest setup + unit tests are deferred to the quality sub-phase (group D).

---

## Pre-flight (orchestrator runs directly, no commit)

- [ ] **Step 0.1: Confirm branch state**

```bash
git status                                # working tree clean, on plan-07d-web-timer-seo
git log --oneline -3
```

Expected: HEAD at `0c339eb docs(plans): add web sub-phase 7d design` (or the just-added plan commit if you create the plan first), branched from the latest `main`.

If the branch doesn't exist yet:

```bash
git checkout -b plan-07d-web-timer-seo
```

- [ ] **Step 0.2: Confirm api is up + seeded + scramble works**

```bash
curl -s "http://localhost:3001/v1/scramble?puzzle=3x3" | jq -c '{notation, length}'
curl -s "http://localhost:3001/v1/scramble/case/t-perm" | jq -c '{notation, length}'
```

Expected: each returns `{"notation": "<25 moves>", "length": 25}` (or similar). If the api isn't running: `pnpm --filter @rubik/api dev`.

- [ ] **Step 0.3: Confirm dependencies are installed**

```bash
grep -E '"(zustand|@tanstack/react-query|sonner|next-themes)"' apps/web/package.json
```

Expected: all four present. No new deps required for 7d.

- [ ] **Step 0.4: Confirm SVG views are available**

```bash
grep -E "PLLView|OLLView|F2LView|TopView" apps/web/src/components/cube/cube-state-diagram.tsx
```

Expected: all four named. The OG image will reuse this dispatcher; if it's gone or renamed, fix that before continuing.

---

## Task 1: timer pure utilities (format + stats)

Two pure modules, no React, no zustand. Both will be consumed by hooks and components in later tasks.

**Files:**
- Create: `apps/web/src/features/timer/format.ts`
- Create: `apps/web/src/features/timer/stats.ts`
- Create: `apps/web/src/features/timer/types.ts`

- [ ] **Step 1.1: Define shared types**

```ts
// apps/web/src/features/timer/types.ts
export type Penalty = 'OK' | 'PLUS_TWO' | 'DNF'

export interface SolveTime {
  id: string
  rawMs: number
  penalty: Penalty
  inspectionMs: number
  scramble: string
  caseSlug: string | null
  createdAt: string
}

export interface AverageResult {
  ms: number | null
  isDNF: boolean
}
```

- [ ] **Step 1.2: Format helper**

```ts
// apps/web/src/features/timer/format.ts
const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const CENTI_PER_MS = 0.1

export const formatMs = (ms: number): string => {
  if (ms < 0) return '0.00'
  const minutes = Math.floor(ms / MS_PER_MINUTE)
  const remainder = ms - minutes * MS_PER_MINUTE
  const seconds = Math.floor(remainder / MS_PER_SECOND)
  const centis = Math.floor((remainder - seconds * MS_PER_SECOND) * CENTI_PER_MS)
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
  }
  return `${seconds}.${String(centis).padStart(2, '0')}`
}

export const formatPenalty = (p: 'OK' | 'PLUS_TWO' | 'DNF'): string => {
  if (p === 'PLUS_TWO') return '+2'
  if (p === 'DNF') return 'DNF'
  return ''
}
```

- [ ] **Step 1.3: Stats math (WCA ao5/ao12)**

```ts
// apps/web/src/features/timer/stats.ts
import type { AverageResult, SolveTime } from './types'

const PLUS_TWO_MS = 2_000
const AO5_LENGTH = 5
const AO12_LENGTH = 12
const AO5_TRIM = 1
const AO12_TRIM = 1
const MAX_DNF_FOR_AVG = 1

export const recordedMs = (t: SolveTime): number =>
  t.penalty === 'PLUS_TWO' ? t.rawMs + PLUS_TWO_MS : t.rawMs

const isDNF = (t: SolveTime): boolean => t.penalty === 'DNF'

export const best = (times: SolveTime[]): number | null => {
  const valid = times.filter((t) => !isDNF(t))
  if (valid.length === 0) return null
  return Math.min(...valid.map(recordedMs))
}

export const worst = (times: SolveTime[]): number | null => {
  const valid = times.filter((t) => !isDNF(t))
  if (valid.length === 0) return null
  return Math.max(...valid.map(recordedMs))
}

const trimmedAverage = (
  window: SolveTime[],
  trim: number,
): AverageResult => {
  const dnfCount = window.filter(isDNF).length
  if (dnfCount > MAX_DNF_FOR_AVG) {
    return { ms: null, isDNF: true }
  }
  const values = window.map((t) => (isDNF(t) ? Number.POSITIVE_INFINITY : recordedMs(t)))
  values.sort((a, b) => a - b)
  const middle = values.slice(trim, values.length - trim)
  const sum = middle.reduce((acc, v) => acc + v, 0)
  return { ms: Math.round(sum / middle.length), isDNF: false }
}

export const ao5 = (times: SolveTime[]): AverageResult | null => {
  if (times.length < AO5_LENGTH) return null
  return trimmedAverage(times.slice(0, AO5_LENGTH), AO5_TRIM)
}

export const ao12 = (times: SolveTime[]): AverageResult | null => {
  if (times.length < AO12_LENGTH) return null
  return trimmedAverage(times.slice(0, AO12_LENGTH), AO12_TRIM)
}
```

Note: `times` is expected newest-first per `4.3` of the design doc. Stats slice the front of the array.

- [ ] **Step 1.4: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/src/features/timer/
git commit -m "feat(web): add timer format + stats utilities"
```

---

## Task 2: zustand store with persist middleware

State machine + history. Per design §4.2, the discriminated `phase` union is in-memory only; `times[]` is persisted.

**Files:**
- Create: `apps/web/src/features/timer/store.ts`

- [ ] **Step 2.1: Write the store**

```ts
// apps/web/src/features/timer/store.ts
'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { Penalty, SolveTime } from './types'

const INSPECTION_LIMIT_MS = 15_000
const PLUS_TWO_LIMIT_MS = 17_000
const HISTORY_CAP = 100
const STORAGE_KEY = 'rubik:timer:v1'

export type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'inspecting'; startedAt: number }
  | { kind: 'ready'; inspectionMs: number }
  | { kind: 'solving'; startedAt: number; inspectionMs: number }
  | { kind: 'done'; rawMs: number; inspectionMs: number; appliedPenalty: Penalty }

interface TimerState {
  phase: TimerPhase
  times: SolveTime[]
  startInspection: (now: number) => void
  arm: (now: number) => void
  startSolving: (now: number) => void
  finishSolve: (now: number, scramble: string, caseSlug: string | null) => void
  reset: () => void
  editPenalty: (id: string, penalty: Penalty) => void
  deleteTime: (id: string) => void
  clearHistory: () => void
}

const computeAutoPenalty = (inspectionMs: number): Penalty => {
  if (inspectionMs <= INSPECTION_LIMIT_MS) return 'OK'
  if (inspectionMs <= PLUS_TWO_LIMIT_MS) return 'PLUS_TWO'
  return 'DNF'
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      phase: { kind: 'idle' },
      times: [],
      startInspection: (now) =>
        set({ phase: { kind: 'inspecting', startedAt: now } }),
      arm: (now) =>
        set((state) => {
          if (state.phase.kind !== 'inspecting') return state
          return { phase: { kind: 'ready', inspectionMs: now - state.phase.startedAt } }
        }),
      startSolving: (now) =>
        set((state) => {
          if (state.phase.kind !== 'ready') return state
          return {
            phase: {
              kind: 'solving',
              startedAt: now,
              inspectionMs: state.phase.inspectionMs,
            },
          }
        }),
      finishSolve: (now, scramble, caseSlug) =>
        set((state) => {
          if (state.phase.kind !== 'solving') return state
          const rawMs = now - state.phase.startedAt
          const appliedPenalty = computeAutoPenalty(state.phase.inspectionMs)
          const time: SolveTime = {
            id: crypto.randomUUID(),
            rawMs,
            penalty: appliedPenalty,
            inspectionMs: state.phase.inspectionMs,
            scramble,
            caseSlug,
            createdAt: new Date().toISOString(),
          }
          const nextTimes = [time, ...state.times].slice(0, HISTORY_CAP)
          return {
            phase: { kind: 'done', rawMs, inspectionMs: state.phase.inspectionMs, appliedPenalty },
            times: nextTimes,
          }
        }),
      reset: () => set({ phase: { kind: 'idle' } }),
      editPenalty: (id, penalty) =>
        set((state) => ({
          times: state.times.map((t) => (t.id === id ? { ...t, penalty } : t)),
        })),
      deleteTime: (id) =>
        set((state) => ({ times: state.times.filter((t) => t.id !== id) })),
      clearHistory: () => set({ times: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ times: state.times }),
    },
  ),
)
```

- [ ] **Step 2.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/src/features/timer/store.ts
git commit -m "feat(web): add timer zustand store with persist middleware"
```

---

## Task 3: scramble query keys + use-scramble hook

Public api endpoint, no auth header. Used by the timer page; mode determines the URL.

**Files:**
- Create: `apps/web/src/features/scramble/query-keys.ts`
- Create: `apps/web/src/features/scramble/use-scramble.ts`

- [ ] **Step 3.1: Query-key factory**

```ts
// apps/web/src/features/scramble/query-keys.ts
export const scrambleKeys = {
  all: ['scramble'] as const,
  random: () => ['scramble', 'random'] as const,
  forCase: (slug: string) => ['scramble', 'case', slug] as const,
}
```

- [ ] **Step 3.2: TanStack Query hook**

```ts
// apps/web/src/features/scramble/use-scramble.ts
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrambleResultSchema, type ScrambleResult } from '@rubik/shared'

import { publicEnv } from '@/lib/env.client'

import { scrambleKeys } from './query-keys'

export type ScrambleMode = { kind: 'random' } | { kind: 'case'; slug: string }

const fetchScramble = async (mode: ScrambleMode): Promise<ScrambleResult> => {
  const url =
    mode.kind === 'random'
      ? `${publicEnv.NEXT_PUBLIC_API_URL}/v1/scramble?puzzle=3x3`
      : `${publicEnv.NEXT_PUBLIC_API_URL}/v1/scramble/case/${encodeURIComponent(mode.slug)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`scramble fetch failed: ${res.status}`)
  }
  return ScrambleResultSchema.parse(await res.json())
}

const queryKeyFor = (mode: ScrambleMode) =>
  mode.kind === 'random' ? scrambleKeys.random() : scrambleKeys.forCase(mode.slug)

export const useScramble = (mode: ScrambleMode) => {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: queryKeyFor(mode),
    queryFn: () => fetchScramble(mode),
    staleTime: 0,
    gcTime: 0,
  })
  const refetchNext = () => {
    qc.invalidateQueries({ queryKey: queryKeyFor(mode) })
  }
  return { ...query, refetchNext }
}
```

Note: `staleTime: 0` and `gcTime: 0` together force a fresh fetch every visit — exactly what the timer wants. `refetchNext()` is called by the page on Done → Idle transitions to load the next scramble eagerly.

- [ ] **Step 3.3: Verify shared schema export**

```bash
grep -n "ScrambleResultSchema\|ScrambleResult" packages/shared/src/index.ts | head
```

Expected: both names exported. If the schema name differs in `@rubik/shared`, update the import to match. The api's `ScrambleResult` type was added in api sub-phase 5a — check `packages/shared/src/schemas/scramble.ts` if needed.

- [ ] **Step 3.4: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/features/scramble/
git commit -m "feat(web): add scramble query keys and use-scramble hook"
```

---

## Task 4: timer presentation components (display + scramble)

Two small client components. Both stateless — they read from props.

**Files:**
- Create: `apps/web/src/components/timer/timer-display.tsx`
- Create: `apps/web/src/components/timer/scramble-display.tsx`

- [ ] **Step 4.1: TimerDisplay**

```tsx
// apps/web/src/components/timer/timer-display.tsx
'use client'

import { cn } from '@/lib/cn'
import { formatMs } from '@/features/timer/format'
import type { TimerPhase } from '@/features/timer/store'

interface Props {
  phase: TimerPhase
  liveMs: number
}

const phaseColor = (kind: TimerPhase['kind']): string => {
  switch (kind) {
    case 'idle':
      return 'text-foreground'
    case 'inspecting':
      return 'text-yellow-500'
    case 'ready':
      return 'text-green-500'
    case 'solving':
      return 'text-foreground'
    case 'done':
      return 'text-foreground'
  }
}

export const TimerDisplay = ({ phase, liveMs }: Props) => {
  const value =
    phase.kind === 'inspecting'
      ? Math.max(0, Math.ceil((15_000 - liveMs) / 1000)).toString()
      : phase.kind === 'solving'
        ? formatMs(liveMs)
        : phase.kind === 'done'
          ? formatMs(phase.rawMs)
          : phase.kind === 'ready'
            ? 'READY'
            : '0.00'
  return (
    <div
      className={cn(
        'mx-auto select-none text-center font-mono text-7xl font-bold tabular-nums tracking-tight md:text-9xl',
        phaseColor(phase.kind),
      )}
      aria-live="polite"
    >
      {value}
    </div>
  )
}
```

- [ ] **Step 4.2: ScrambleDisplay**

```tsx
// apps/web/src/components/timer/scramble-display.tsx
'use client'

interface Props {
  scramble: string | null
  isHidden: boolean
  isLoading: boolean
}

export const ScrambleDisplay = ({ scramble, isHidden, isLoading }: Props) => {
  if (isHidden) {
    return (
      <p className="text-center font-mono text-lg text-muted-foreground">
        Solve in progress…
      </p>
    )
  }
  if (isLoading || !scramble) {
    return (
      <p className="text-center font-mono text-lg text-muted-foreground">
        Loading scramble…
      </p>
    )
  }
  return (
    <p
      className="break-words text-center font-mono text-lg text-foreground md:text-xl"
      aria-label={`Scramble: ${scramble}`}
    >
      {scramble}
    </p>
  )
}
```

- [ ] **Step 4.3: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 4.4: Commit**

```bash
git add apps/web/src/components/timer/
git commit -m "feat(web): add timer display and scramble components"
```

---

## Task 5: TimesList + StatsPanel components

Both are client components reading from the zustand store.

**Files:**
- Create: `apps/web/src/components/timer/times-list.tsx`
- Create: `apps/web/src/components/timer/stats-panel.tsx`

- [ ] **Step 5.1: StatsPanel**

```tsx
// apps/web/src/components/timer/stats-panel.tsx
'use client'

import { ao12, ao5, best, worst } from '@/features/timer/stats'
import { formatMs } from '@/features/timer/format'
import type { SolveTime } from '@/features/timer/types'

interface Props {
  times: SolveTime[]
}

const formatAverage = (avg: { ms: number | null; isDNF: boolean } | null): string => {
  if (avg === null) return '—'
  if (avg.isDNF) return 'DNF'
  return formatMs(avg.ms!)
}

const formatBest = (ms: number | null): string => (ms === null ? '—' : formatMs(ms))

export const StatsPanel = ({ times }: Props) => (
  <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-5">
    <div>
      <dt className="text-xs uppercase text-muted-foreground">Solves</dt>
      <dd className="font-mono text-lg tabular-nums">{times.length}</dd>
    </div>
    <div>
      <dt className="text-xs uppercase text-muted-foreground">Best</dt>
      <dd className="font-mono text-lg tabular-nums">{formatBest(best(times))}</dd>
    </div>
    <div>
      <dt className="text-xs uppercase text-muted-foreground">Worst</dt>
      <dd className="font-mono text-lg tabular-nums">{formatBest(worst(times))}</dd>
    </div>
    <div>
      <dt className="text-xs uppercase text-muted-foreground">Ao5</dt>
      <dd className="font-mono text-lg tabular-nums">{formatAverage(ao5(times))}</dd>
    </div>
    <div>
      <dt className="text-xs uppercase text-muted-foreground">Ao12</dt>
      <dd className="font-mono text-lg tabular-nums">{formatAverage(ao12(times))}</dd>
    </div>
  </dl>
)
```

- [ ] **Step 5.2: TimesList**

```tsx
// apps/web/src/components/timer/times-list.tsx
'use client'

import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatMs } from '@/features/timer/format'
import { recordedMs } from '@/features/timer/stats'
import { useTimerStore } from '@/features/timer/store'
import type { Penalty, SolveTime } from '@/features/timer/types'

const cyclePenalty = (current: Penalty): Penalty => {
  if (current === 'OK') return 'PLUS_TWO'
  if (current === 'PLUS_TWO') return 'DNF'
  return 'OK'
}

const penaltyLabel = (p: Penalty): string => {
  if (p === 'PLUS_TWO') return '+2'
  if (p === 'DNF') return 'DNF'
  return 'OK'
}

const Row = ({ time, index }: { time: SolveTime; index: number }) => {
  const editPenalty = useTimerStore((s) => s.editPenalty)
  const deleteTime = useTimerStore((s) => s.deleteTime)
  return (
    <li className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
      <span className="w-10 text-sm text-muted-foreground tabular-nums">#{index}</span>
      <span className="flex-1 font-mono tabular-nums">
        {time.penalty === 'DNF' ? 'DNF' : formatMs(recordedMs(time))}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => editPenalty(time.id, cyclePenalty(time.penalty))}
        className="mx-2 w-16 font-mono"
        aria-label={`Cycle penalty for solve #${index}`}
      >
        {penaltyLabel(time.penalty)}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => deleteTime(time.id)}
        aria-label={`Delete solve #${index}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  )
}

interface Props {
  times: SolveTime[]
}

export const TimesList = ({ times }: Props) => {
  if (times.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Space</kbd> to begin.
      </p>
    )
  }
  return (
    <ul className="rounded-lg border border-border bg-card p-2">
      {times.map((time, idx) => (
        <Row key={time.id} time={time} index={times.length - idx} />
      ))}
    </ul>
  )
}
```

- [ ] **Step 5.3: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 5.4: Commit**

```bash
git add apps/web/src/components/timer/
git commit -m "feat(web): add timer times-list and stats-panel components"
```

---

## Task 6: /timer page (state machine wiring)

Single client page that owns the keyboard handler and the RAF loop. Reads `?case=` and routes the scramble fetch accordingly.

**Files:**
- Create: `apps/web/src/app/timer/page.tsx`

- [ ] **Step 6.1: Write the page**

```tsx
// apps/web/src/app/timer/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ScrambleDisplay } from '@/components/timer/scramble-display'
import { StatsPanel } from '@/components/timer/stats-panel'
import { TimerDisplay } from '@/components/timer/timer-display'
import { TimesList } from '@/components/timer/times-list'
import { useScramble, type ScrambleMode } from '@/features/scramble/use-scramble'
import { useTimerStore } from '@/features/timer/store'

const TimerPageInner = () => {
  const searchParams = useSearchParams()
  const caseSlug = searchParams.get('case')
  const [resolvedMode, setResolvedMode] = useState<ScrambleMode>(
    caseSlug ? { kind: 'case', slug: caseSlug } : { kind: 'random' },
  )

  const scramble = useScramble(resolvedMode)
  const phase = useTimerStore((s) => s.phase)
  const times = useTimerStore((s) => s.times)
  const startInspection = useTimerStore((s) => s.startInspection)
  const arm = useTimerStore((s) => s.arm)
  const startSolving = useTimerStore((s) => s.startSolving)
  const finishSolve = useTimerStore((s) => s.finishSolve)
  const reset = useTimerStore((s) => s.reset)

  const [liveMs, setLiveMs] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (caseSlug && scramble.isError) {
      toast.error(`Unknown case "${caseSlug}" — falling back to random scrambles.`)
      setResolvedMode({ kind: 'random' })
    }
  }, [caseSlug, scramble.isError])

  useEffect(() => {
    if (phase.kind !== 'inspecting' && phase.kind !== 'solving') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setLiveMs(0)
      return
    }
    const startedAt = phase.startedAt
    const tick = () => {
      setLiveMs(performance.now() - startedAt)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [phase])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      }
      e.preventDefault()
      const now = performance.now()
      if (phase.kind === 'idle') {
        startInspection(now)
      } else if (phase.kind === 'inspecting') {
        arm(now)
      } else if (phase.kind === 'solving') {
        finishSolve(now, scramble.data?.notation ?? '', resolvedMode.kind === 'case' ? resolvedMode.slug : null)
        scramble.refetchNext()
      } else if (phase.kind === 'done') {
        reset()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const now = performance.now()
      if (phase.kind === 'ready') {
        startSolving(now)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [phase, scramble, resolvedMode, startInspection, arm, startSolving, finishSolve, reset])

  const headerLabel =
    resolvedMode.kind === 'case' ? `Drilling: ${resolvedMode.slug}` : 'Random WCA scramble'

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Timer</h1>
        <p className="text-sm text-muted-foreground">{headerLabel}</p>
      </header>
      <ScrambleDisplay
        scramble={scramble.data?.notation ?? null}
        isHidden={phase.kind === 'solving' || phase.kind === 'ready'}
        isLoading={scramble.isLoading}
      />
      <TimerDisplay phase={phase} liveMs={liveMs} />
      <StatsPanel times={times} />
      <TimesList times={times} />
    </main>
  )
}

export default function TimerPage() {
  return <TimerPageInner />
}
```

- [ ] **Step 6.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 6.3: Verify dev render**

```bash
pnpm --filter @rubik/web dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/timer
```

Expected: `200`. Then visit `http://localhost:3000/timer` in the browser, press Space, confirm the inspection countdown starts. Stop dev with Ctrl-C.

- [ ] **Step 6.4: Commit**

```bash
git add apps/web/src/app/timer/
git commit -m "feat(web): add /timer page with keyboard state machine"
```

---

## Task 7: case-page CTA

Single link added next to the existing `<TrackCaseButton />`. Server-rendered, no client JS.

**Files:**
- Modify: `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`

- [ ] **Step 7.1: Add the link**

Open the case page. Find the block that renders `<TrackCaseButton />` (added in 7c, around the `mb-8` div below the H1). Wrap or extend that block so it also renders the timer link:

```tsx
import Link from 'next/link'
import type { Route } from 'next'

// ... in JSX, replace the existing CTA block with:
<div className="mb-8 flex items-center gap-4">
  {session?.apiAccessToken ? (
    <TrackCaseButton
      caseId={caseData.id}
      caseSlug={caseData.slug}
      initialAlgorithm={myAlgorithm}
    />
  ) : (
    <Link
      href="/login?next=/3x3/cfop/pll/t-perm"
      className="text-sm text-primary underline-offset-4 hover:underline"
    >
      Sign in to track this case
    </Link>
  )}
  <Link
    href={`/timer?case=${caseData.slug}` as Route}
    className="text-sm text-primary underline-offset-4 hover:underline"
  >
    Time this case →
  </Link>
</div>
```

(Adjust the surrounding wrapper if it already exists — just add the `<Link>` to `/timer?case=...` inside it. `Link` may already be imported from 7c.)

- [ ] **Step 7.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green. The `as Route` cast matches the 7c precedent.

- [ ] **Step 7.3: Commit**

```bash
git add apps/web/src/app/3x3/\[method\]/\[set\]/\[case\]/page.tsx
git commit -m "feat(web): add 'time this case' link to case page"
```

---

## Task 8: notation-prose + jsonld helpers

Pure modules used only by the case page's JSON-LD script.

**Files:**
- Create: `apps/web/src/lib/notation-prose.ts`
- Create: `apps/web/src/lib/jsonld.ts`

- [ ] **Step 8.1: notation-prose**

```ts
// apps/web/src/lib/notation-prose.ts
const FACE_NAMES: Record<string, string> = {
  U: 'top',
  D: 'bottom',
  R: 'right',
  L: 'left',
  F: 'front',
  B: 'back',
  M: 'middle (M-slice)',
  E: 'equatorial (E-slice)',
  S: 'standing (S-slice)',
  x: 'whole cube on R',
  y: 'whole cube on U',
  z: 'whole cube on F',
}

export const moveToProse = (move: string): string => {
  const trimmed = move.trim()
  if (trimmed.length === 0) return ''
  const isCounter = trimmed.includes("'")
  const isDouble = trimmed.includes('2')
  const isWide = trimmed.toLowerCase().endsWith('w') || /^[a-z]$/.test(trimmed[0]!)
  const baseChar = trimmed[0]!
  const upper = baseChar.toUpperCase()
  const face = FACE_NAMES[upper] ?? upper
  if (isDouble) return `Rotate the ${face} face 180°.`
  const direction = isCounter ? 'counter-clockwise' : 'clockwise'
  const wide = isWide ? ' (wide turn)' : ''
  return `Rotate the ${face} face${wide} ${direction}.`
}
```

- [ ] **Step 8.2: jsonld**

```ts
// apps/web/src/lib/jsonld.ts
import { moveToProse } from './notation-prose'

interface CaseJsonLdInput {
  displayName: string
  url: string
  description: string
  primaryNotation: string
}

export const caseHowToJsonLd = (input: CaseJsonLdInput) => {
  const moves = input.primaryNotation.split(/\s+/).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `Solve the ${input.displayName} case`,
    description: input.description,
    url: input.url,
    totalTime: `PT${Math.max(2, moves.length)}S`,
    step: moves.map((move, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: move,
      text: moveToProse(move),
    })),
  }
}
```

- [ ] **Step 8.3: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 8.4: Commit**

```bash
git add apps/web/src/lib/notation-prose.ts apps/web/src/lib/jsonld.ts
git commit -m "feat(web): add notation-prose and jsonld helpers"
```

---

## Task 9: emit JSON-LD on case page

**Files:**
- Modify: `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`

- [ ] **Step 9.1: Inject the script tag**

At the top of the case page's main JSX (inside the page component, before the H1 or main content), add:

```tsx
import { caseHowToJsonLd } from '@/lib/jsonld'

// inside the JSX, near the top of <main>:
const primaryVariant = caseData.variants.find((v) => v.isPrimary)
const jsonLd = primaryVariant
  ? caseHowToJsonLd({
      displayName: caseData.displayName,
      url: `https://rubik-algorithm.example.com/${puzzle}/${method}/${set}/${caseSlug}`,
      description: caseData.recognitionMd?.slice(0, 200) ?? `${caseData.displayName} algorithm.`,
      primaryNotation: primaryVariant.notation,
    })
  : null

// later in JSX, just inside <main>:
{jsonLd ? (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
  />
) : null}
```

(The base URL placeholder `rubik-algorithm.example.com` should be swapped for whatever production domain is set up in Plan 09. For now, hard-code the example domain — the only consumer is Google's crawler, which isn't going to hit dev.)

If `caseData.variants` doesn't have an `isPrimary` field as named, look at the `7b` schema for the actual field name (likely `is_primary` → camelCase). Inspect via:

```bash
grep -A5 "variants" apps/web/src/features/catalog/catalog-fetchers.ts | head -20
```

- [ ] **Step 9.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/src/app/3x3/\[method\]/\[set\]/\[case\]/page.tsx
git commit -m "feat(web): emit json-ld howto on case page"
```

---

## Task 10: app/sitemap.ts

Reuses `getAllCases()` from 7c. Build-time enumeration of catalog URLs.

**Files:**
- Create: `apps/web/src/app/sitemap.ts`

- [ ] **Step 10.1: Write the sitemap**

```ts
// apps/web/src/app/sitemap.ts
import type { MetadataRoute } from 'next'

import { getAllCases } from '@/features/catalog/catalog-fetchers'
import { publicEnv } from '@/lib/env.client'

const BASE_URL = publicEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const cases = await getAllCases()
  const now = new Date()

  const seen = new Set<string>()
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
  ]

  for (const c of cases) {
    const puzzleUrl = `${BASE_URL}/${c.puzzleSlug}`
    if (!seen.has(puzzleUrl)) {
      seen.add(puzzleUrl)
      entries.push({ url: puzzleUrl, lastModified: now, changeFrequency: 'weekly', priority: 0.8 })
    }
    const methodUrl = `${BASE_URL}/${c.puzzleSlug}/${c.methodSlug}`
    if (!seen.has(methodUrl)) {
      seen.add(methodUrl)
      entries.push({ url: methodUrl, lastModified: now, changeFrequency: 'weekly', priority: 0.7 })
    }
    const setUrl = `${BASE_URL}/${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}`
    if (!seen.has(setUrl)) {
      seen.add(setUrl)
      entries.push({ url: setUrl, lastModified: now, changeFrequency: 'weekly', priority: 0.6 })
    }
    entries.push({
      url: `${BASE_URL}/${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}/${c.case.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    })
  }

  return entries
}

export default sitemap
```

- [ ] **Step 10.2: Add `NEXT_PUBLIC_SITE_URL` to env**

Check `apps/web/src/lib/env.client.ts` and append `NEXT_PUBLIC_SITE_URL: z.string().url().optional()` to the public env schema. Add the variable to `.env.example` with a localhost default. The sitemap falls back to `localhost:3000` when unset, so dev still works.

- [ ] **Step 10.3: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 10.4: Verify it renders**

Boot the api (`pnpm --filter @rubik/api dev`) then web (`pnpm --filter @rubik/web dev`):

```bash
curl -s http://localhost:3000/sitemap.xml | head -30
```

Expected: XML with `<url>` entries for `/`, `/3x3`, `/3x3/cfop`, sets, and every seeded case slug. Stop both dev processes when verified.

- [ ] **Step 10.5: Commit**

```bash
git add apps/web/src/app/sitemap.ts apps/web/src/lib/env.client.ts apps/web/.env.example
git commit -m "feat(web): add sitemap.ts walking the full catalog"
```

---

## Task 11: app/robots.ts

**Files:**
- Create: `apps/web/src/app/robots.ts`

- [ ] **Step 11.1: Write robots**

```ts
// apps/web/src/app/robots.ts
import type { MetadataRoute } from 'next'

import { publicEnv } from '@/lib/env.client'

const BASE_URL = publicEnv.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/me/', '/embed/', '/api/'],
    },
  ],
  sitemap: `${BASE_URL}/sitemap.xml`,
})

export default robots
```

- [ ] **Step 11.2: Verify it renders**

```bash
curl -s http://localhost:3000/robots.txt
```

Expected: `User-Agent: *` plus the disallow lines and sitemap URL. (Boot dev if not running.)

- [ ] **Step 11.3: Commit**

```bash
git add apps/web/src/app/robots.ts
git commit -m "feat(web): add robots.ts with /me /embed /api disallow"
```

---

## Task 12: dynamic per-case opengraph-image

`next/og` `<ImageResponse>` co-located with the case route. Renders display name + SVG diagram on a 1200×630 canvas.

**Files:**
- Create: `apps/web/src/app/3x3/[method]/[set]/[case]/opengraph-image.tsx`

- [ ] **Step 12.1: Write the OG generator**

```tsx
// apps/web/src/app/3x3/[method]/[set]/[case]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

import { getCaseWithVariants } from '@/features/catalog/catalog-fetchers'
import { CubeStateDiagram } from '@/components/cube/cube-state-diagram'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ method: string; set: string; case: string }>
}

const OgImage = async ({ params }: Props) => {
  const { case: caseSlug } = await params
  let caseData
  try {
    caseData = await getCaseWithVariants(caseSlug)
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            color: '#fafafa',
            fontSize: 64,
            fontFamily: 'system-ui',
          }}
        >
          rubik-algorithm
        </div>
      ),
      size,
    )
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          background: '#0a0a0a',
          color: '#fafafa',
          padding: 60,
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 600 }}>
          <div style={{ fontSize: 28, color: '#a1a1aa' }}>rubik-algorithm</div>
          <div style={{ fontSize: 96, fontWeight: 700, marginTop: 12 }}>
            {caseData.displayName}
          </div>
          <div style={{ fontSize: 32, color: '#a1a1aa', marginTop: 8 }}>
            3x3 · cfop · {caseData.slug}
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <CubeStateDiagram
            caseState={caseData.caseState}
            recognitionBasis={caseData.recognitionBasis}
            size={420}
          />
        </div>
      </div>
    ),
    size,
  )
}

export default OgImage
```

Note: `next/og` understands a subset of CSS via inline `style`. SVG children render as long as they contain valid SVG primitives (`<rect>`, `<g>`, etc.) — exactly what `CubeStateDiagram` produces. If a runtime error surfaces about a non-SVG child, inspect what `CubeStateDiagram` outputs and inline the SVG fragment instead.

- [ ] **Step 12.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green. If `getCaseWithVariants` rejects on the type signature for `caseState` / `recognitionBasis`, double-check the names against the schema.

- [ ] **Step 12.3: Verify it renders**

Dev must be running with the api. Visit:

```
http://localhost:3000/3x3/cfop/pll/t-perm/opengraph-image
```

Expected: a 1200×630 PNG showing "T-Perm" + the cube diagram. Some content negotiation quirks may force you to view via DevTools network tab.

- [ ] **Step 12.4: Commit**

```bash
git add apps/web/src/app/3x3/\[method\]/\[set\]/\[case\]/opengraph-image.tsx
git commit -m "feat(web): add dynamic per-case opengraph-image"
```

---

## Task 13: build smoke (no commit)

The build is the most thorough gate. It evaluates `sitemap()` and any static `generateStaticParams` against the live api at build time, so the api MUST be running.

- [ ] **Step 13.1: Confirm api is up**

```bash
curl -s "http://localhost:3001/v1/scramble?puzzle=3x3" | jq -c '{notation, length}'
```

Expected: a notation string. Otherwise `pnpm --filter @rubik/api dev`.

- [ ] **Step 13.2: Run typecheck + lint + build**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
pnpm --filter @rubik/web build
```

Expected:
- typecheck and lint: green.
- build: prior catalog SSG count holds; `/timer` is `ƒ (Dynamic)`; `/sitemap.xml` and `/robots.txt` are listed; `opengraph-image` shows under each `[case]` route. No build errors.

- [ ] **Step 13.3: Confirm bundle stays under budget**

In the build output, `/timer` First Load JS should be under 200 KB per the `070-testing-rule.md` perf budget (§19.9). Zustand + TanStack Query are already in the shared bundle from 7c, so the marginal cost is the timer code only. Flag as follow-up if it exceeds.

- [ ] **Step 13.4: No commit for this task** — verification only.

---

## Task 14: manual smoke verification (no commit)

Validates timer + SEO end-to-end against real seeded data.

- [ ] **Step 14.1: Boot web dev**

```bash
pnpm --filter @rubik/web dev
```

Wait for "Ready in N ms" on `http://localhost:3000`.

- [ ] **Step 14.2: Time five solves on /timer**

Visit `http://localhost:3000/timer`. Expected: header "Random WCA scramble", scramble notation, "0.00" display, empty stats panel, "Press Space to begin" empty list. Press Space → inspection countdown shows "15", colors yellow at 8s, red at 12s. Press Space → "READY" shows. Release Space → timer counts up. Press Space → time is recorded, scramble auto-rotates. Repeat five times. Expected: stats panel shows `Solves: 5`, best, worst, ao5; ao12 still `—`. Times list shows five rows newest-first.

- [ ] **Step 14.3: Edit a penalty**

Click the `OK` button on row #1. Expected: changes to `+2`, recorded ms updates, ao5 recomputes. Click again → `DNF` (row shows "DNF"). Click again → `OK`.

- [ ] **Step 14.4: Test inspection auto-penalty**

Press Space, wait 16s without arming. Press Space → arms (READY). Release → solve starts. Press Space to stop. Expected: the recorded time has a `+2` pill. Wait 18s on the next solve, then complete. Expected: that solve is recorded as `DNF`.

- [ ] **Step 14.5: Test per-case mode**

Visit `http://localhost:3000/timer?case=t-perm`. Expected: header reads "Drilling: t-perm". Scramble notation looks like a normal scramble. After completing one solve, inspect the times in localStorage (DevTools → Application → Local Storage → `rubik:timer:v1`) and confirm the entry has `caseSlug: "t-perm"`.

- [ ] **Step 14.6: Test unknown-case fallback**

Visit `http://localhost:3000/timer?case=does-not-exist`. Expected: a sonner toast appears: `Unknown case "does-not-exist" — falling back to random scrambles.` Header switches to "Random WCA scramble". Scramble loads.

- [ ] **Step 14.7: Test case-page CTA**

Visit `http://localhost:3000/3x3/cfop/pll/t-perm`. Expected: "Time this case →" link visible next to the existing CTA. Click it → lands on `/timer?case=t-perm`.

- [ ] **Step 14.8: Test SEO surfaces**

Visit:

- `http://localhost:3000/sitemap.xml` — XML lists every case URL.
- `http://localhost:3000/robots.txt` — disallows `/me/`, `/embed/`, `/api/`; sitemap line present.
- `http://localhost:3000/3x3/cfop/pll/t-perm` — view-source, find a `<script type="application/ld+json">` block. Copy its content into Google's [Rich Results Test](https://search.google.com/test/rich-results) — expect `HowTo` valid.
- `http://localhost:3000/3x3/cfop/pll/t-perm/opengraph-image` — image renders (1200×630, "T-Perm" + cube diagram).

- [ ] **Step 14.9: Test localStorage persistence**

Time one solve. Hard-refresh the page (Ctrl-Shift-R). Expected: the times list still has the solve after reload; live timer is `0.00` (in-memory phase reset, persisted history retained).

- [ ] **Step 14.10: Stop dev**

Ctrl-C the `pnpm --filter @rubik/web dev` process.

If any step fails, do not close the sub-phase — fix and re-test.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

```bash
git log --oneline 0c339eb..HEAD
```

Expected (newest first):

```
<hash> feat(web): add dynamic per-case opengraph-image
<hash> feat(web): add robots.ts with /me /embed /api disallow
<hash> feat(web): add sitemap.ts walking the full catalog
<hash> feat(web): emit json-ld howto on case page
<hash> feat(web): add notation-prose and jsonld helpers
<hash> feat(web): add 'time this case' link to case page
<hash> feat(web): add /timer page with keyboard state machine
<hash> feat(web): add timer times-list and stats-panel components
<hash> feat(web): add timer display and scramble components
<hash> feat(web): add scramble query keys and use-scramble hook
<hash> feat(web): add timer zustand store with persist middleware
<hash> feat(web): add timer format + stats utilities
```

(The plan-file commit precedes this sub-phase's branch creation.)

- [ ] **Step F.2: Confirm full quality gates**

```bash
pnpm --filter @rubik/web typecheck && \
  pnpm --filter @rubik/web lint && \
  pnpm --filter @rubik/web build
```

(api must still be running for SSG + sitemap.) Expected: all green.

- [ ] **Step F.3: Done-when checklist (mirrors design §6)**

```
- [x] /timer works keyboard-only: Idle → Inspecting → Ready → Solving → Done
- [x] Inspection countdown shows 15s with 8s/12s color cues; auto-penalty per WCA
- [x] Times list editable (cycle OK/+2/DNF + delete)
- [x] Stats panel shows best, worst, ao5, ao12, count; DNF math matches WCA
- [x] /timer?case=t-perm fetches /v1/scramble/case/t-perm
- [x] Unknown case slug falls back to random with sonner toast
- [x] Case page renders "Time this case →" link to /timer?case={slug}
- [x] localStorage persists times across reloads
- [x] app/sitemap.ts returns every catalog URL
- [x] app/robots.ts disallows /me/, /embed/, /api/
- [x] Case page emits valid JSON-LD HowTo (Google Rich Results Test passes)
- [x] opengraph-image.tsx renders 1200×630 PNG with case name + diagram
- [x] pnpm --filter @rubik/web typecheck && lint && build clean
- [x] Manual smoke 14.2-14.9 verified locally with the running api
- [x] Commits follow lowercase Conventional Commits with scope `web`
```

---

## Out of scope (do not implement)

(Mirrors design §2 — restated for plan-execution clarity.)

- `/embed/visualizer` — defer to 7e (waits on plan 04b).
- Server-side sync of solve history — v2.
- Touch-screen tap-to-start UX — 7e.
- Stackmat / Bluetooth timer integration — v2.
- Variant-specific drilling — depends on `chosenVariantId` picker (group C).
- Sentry, Storybook, Playwright e2e — quality bag (group D).
- `chosenVariantId` picker, `personalNotesMd` editor — tracking-deepening (group C).
- Mobile-optimized command palette — 7e.
- Route groups `(app)/(marketing)/(auth)` — 7e.
- Vitest setup + unit tests for `format` / `stats` / `notation-prose` — quality sub-phase.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Spacebar autorepeat double-fires | `event.repeat` filter in keydown handler. |
| RAF leak across phase transitions | useEffect cleanup cancels RAF on phase change and unmount. |
| Tab-blur stops RAF mid-solve | Acceptable — `performance.now()` keeps wall-clock; display jumps on focus. |
| localStorage version drift if shape changes | `STORAGE_KEY` is `rubik:timer:v1`; bump the suffix on breaking shape changes. |
| Scramble fetch race when phase advances faster than network | `refetchNext()` is fire-and-forget; if the next scramble isn't ready, ScrambleDisplay shows "Loading scramble…". |
| `next/og` can't render `CubeStateDiagram` due to missing primitives | Inline the SVG fragment if `<ImageResponse>` errors at runtime; SVG primitives are supported. |
| JSON-LD URL hard-codes `example.com` | Plan 09 (deployment) will set `NEXT_PUBLIC_SITE_URL`; case page should read that env. |
| Sitemap is build-frozen, content rev mid-deploy doesn't refresh it | Acceptable — content changes ship via deploy anyway. |
| Inspection auto-`+2` / `DNF` thresholds drift from WCA over time | Constants centralized in `store.ts`; one place to update if WCA changes the rule. |
| Empty `caseSlug` in `useScramble` (e.g., `?case=` with no value) | `searchParams.get('case')` returns empty string → treated as `caseSlug` → api 404 → fallback toast. Acceptable. |
