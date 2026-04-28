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
      <span className="w-10 text-sm text-muted-foreground tabular-nums">
        #{index}
      </span>
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
        Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Space</kbd>{' '}
        to begin.
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
