import type { Algorithm, Move, MoveAmount } from '../types'
import { parseAlgorithm } from './parser'

const AMOUNT_MOD: readonly MoveAmount[] = [1, 2, 3]

const combinedAmount = (a: MoveAmount, b: MoveAmount): MoveAmount | 0 => {
  const sum = (a + b) % 4
  if (sum === 0) return 0
  return AMOUNT_MOD[sum - 1]!
}

// Merges adjacent same-axis-same-wide moves (R R = R2, R R' = ∅, R2 R = R').
// Cascades through the result so chains like R U U' R' collapse to ∅.
// Does not reorder commuting parallel-axis pairs (e.g., R L stays R L).
export const cancelMoves = (alg: Algorithm | string): Algorithm => {
  const moves = typeof alg === 'string' ? parseAlgorithm(alg) : alg
  const result: Move[] = []
  for (const move of moves) {
    const last = result[result.length - 1]
    if (last && last.axis === move.axis && last.wide === move.wide) {
      const merged = combinedAmount(last.amount, move.amount)
      result.pop()
      if (merged !== 0) {
        result.push({ axis: last.axis, wide: last.wide, amount: merged })
      }
    } else {
      result.push(move)
    }
  }
  return result
}
