'use client'

import { formatMs } from '@/features/timer/format'
import type { TimerPhase } from '@/features/timer/store'
import { cn } from '@/lib/cn'

interface Props {
  phase: TimerPhase
  liveMs: number
}

const INSPECTION_LIMIT_MS = 15_000
const MS_PER_SECOND = 1000

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

const renderValue = (phase: TimerPhase, liveMs: number): string => {
  if (phase.kind === 'inspecting') {
    return Math.max(
      0,
      Math.ceil((INSPECTION_LIMIT_MS - liveMs) / MS_PER_SECOND),
    ).toString()
  }
  if (phase.kind === 'solving') return formatMs(liveMs)
  if (phase.kind === 'done') return formatMs(phase.rawMs)
  if (phase.kind === 'ready') return 'READY'
  return '0.00'
}

export const TimerDisplay = ({ phase, liveMs }: Props) => (
  <div
    className={cn(
      'mx-auto select-none text-center font-mono text-7xl font-bold tabular-nums tracking-tight md:text-9xl',
      phaseColor(phase.kind),
    )}
    aria-live="polite"
  >
    {renderValue(phase, liveMs)}
  </div>
)
