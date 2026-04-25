import type { Algorithm, Move } from '../types'

const isFaceAxis = (move: Move): boolean =>
  move.axis === 'U' || move.axis === 'D' || move.axis === 'F' || move.axis === 'B' || move.axis === 'R' || move.axis === 'L'

const isSliceAxis = (move: Move): boolean => move.axis === 'M' || move.axis === 'E' || move.axis === 'S'

const isRotation = (move: Move): boolean => move.axis === 'x' || move.axis === 'y' || move.axis === 'z'

// HTM (Half-Turn Metric): every face turn or wide turn = 1, regardless of amount.
// Slices and rotations don't count.
export const htm = (alg: Algorithm): number => {
  let count = 0
  for (const move of alg) {
    if (isRotation(move)) continue
    if (isSliceAxis(move)) continue
    if (isFaceAxis(move)) count += 1
  }
  return count
}

// STM (Slice Turn Metric): every face/wide turn or slice = 1; rotations don't count.
export const stm = (alg: Algorithm): number => {
  let count = 0
  for (const move of alg) {
    if (isRotation(move)) continue
    count += 1
  }
  return count
}

// ETM (Execution Turn Metric): every move (including rotations) counts.
export const etm = (alg: Algorithm): number => alg.length

// QTM (Quarter Turn Metric): each face turn = 1 for 90°, 2 for 180°.
export const qtm = (alg: Algorithm): number => {
  let count = 0
  for (const move of alg) {
    if (isRotation(move)) continue
    if (isSliceAxis(move)) continue
    if (isFaceAxis(move)) count += move.amount === 2 ? 2 : 1
  }
  return count
}
