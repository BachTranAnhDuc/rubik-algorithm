'use client'

import { formatMs } from '@/features/timer/format'
import { ao12, ao5, best, worst } from '@/features/timer/stats'
import type { AverageResult, SolveTime } from '@/features/timer/types'

interface Props {
  times: SolveTime[]
}

const formatAverage = (avg: AverageResult | null): string => {
  if (avg === null) return '—'
  if (avg.isDNF || avg.ms === null) return 'DNF'
  return formatMs(avg.ms)
}

const formatBest = (ms: number | null): string =>
  ms === null ? '—' : formatMs(ms)

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
