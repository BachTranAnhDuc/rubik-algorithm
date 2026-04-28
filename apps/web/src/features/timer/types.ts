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
