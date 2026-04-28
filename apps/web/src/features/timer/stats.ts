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

const trimmedAverage = (window: SolveTime[], trim: number): AverageResult => {
  const dnfCount = window.filter(isDNF).length
  if (dnfCount > MAX_DNF_FOR_AVG) {
    return { ms: null, isDNF: true }
  }
  const values = window.map((t) =>
    isDNF(t) ? Number.POSITIVE_INFINITY : recordedMs(t),
  )
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
