'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
  const [brokenSlug, setBrokenSlug] = useState<string | null>(null)
  const lastToastedRef = useRef<string | null>(null)

  const resolvedMode = useMemo<ScrambleMode>(
    () =>
      caseSlug && caseSlug.length > 0 && brokenSlug !== caseSlug
        ? { kind: 'case', slug: caseSlug }
        : { kind: 'random' },
    [caseSlug, brokenSlug],
  )

  const scramble = useScramble(resolvedMode)
  const phase = useTimerStore((s) => s.phase)
  const times = useTimerStore((s) => s.times)
  const startInspection = useTimerStore((s) => s.startInspection)
  const arm = useTimerStore((s) => s.arm)
  const startSolving = useTimerStore((s) => s.startSolving)
  const finishSolve = useTimerStore((s) => s.finishSolve)
  const reset = useTimerStore((s) => s.reset)

  if (
    caseSlug &&
    resolvedMode.kind === 'case' &&
    scramble.isError &&
    brokenSlug !== caseSlug
  ) {
    setBrokenSlug(caseSlug)
  }

  useEffect(() => {
    if (brokenSlug && lastToastedRef.current !== brokenSlug) {
      lastToastedRef.current = brokenSlug
      toast.error(
        `Unknown case "${brokenSlug}" — falling back to random scrambles.`,
      )
    }
  }, [brokenSlug])

  const [liveMs, setLiveMs] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase.kind !== 'inspecting' && phase.kind !== 'solving') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
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
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
          return
        }
      }
      e.preventDefault()
      const now = performance.now()
      if (phase.kind === 'idle') {
        startInspection(now)
      } else if (phase.kind === 'inspecting') {
        arm(now)
      } else if (phase.kind === 'solving') {
        finishSolve(
          now,
          scramble.data?.scramble ?? '',
          resolvedMode.kind === 'case' ? resolvedMode.slug : null,
        )
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
  }, [
    phase,
    scramble,
    resolvedMode,
    startInspection,
    arm,
    startSolving,
    finishSolve,
    reset,
  ])

  const headerLabel =
    resolvedMode.kind === 'case'
      ? `Drilling: ${resolvedMode.slug}`
      : 'Random WCA scramble'

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold">Timer</h1>
        <p className="text-sm text-muted-foreground">{headerLabel}</p>
      </header>
      <ScrambleDisplay
        scramble={scramble.data?.scramble ?? null}
        isHidden={phase.kind === 'solving' || phase.kind === 'ready'}
        isLoading={scramble.isLoading}
      />
      <TimerDisplay phase={phase} liveMs={liveMs} />
      <StatsPanel times={times} />
      <TimesList times={times} />
    </main>
  )
}

const TimerPage = () => (
  <Suspense fallback={null}>
    <TimerPageInner />
  </Suspense>
)

export default TimerPage
