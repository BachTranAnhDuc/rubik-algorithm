import type { Algorithm, Face, Move, MoveAmount, MoveAxis } from '../types'
import { parseAlgorithm } from './parser'

export type MirrorPlane = 'M' | 'S' | 'E'

const FACE_SWAP: Readonly<Record<MirrorPlane, Partial<Record<Face, Face>>>> = {
  M: { R: 'L', L: 'R' },
  S: { F: 'B', B: 'F' },
  E: { U: 'D', D: 'U' },
}

const INVERT_AMOUNT: Readonly<Record<MoveAmount, MoveAmount>> = { 1: 3, 2: 2, 3: 1 }

const isFace = (axis: MoveAxis): axis is Face =>
  axis === 'U' || axis === 'D' || axis === 'F' || axis === 'B' || axis === 'R' || axis === 'L'

export const mirrorMove = (move: Move, plane: MirrorPlane = 'M'): Move => {
  const axis: MoveAxis = isFace(move.axis) ? (FACE_SWAP[plane][move.axis] ?? move.axis) : move.axis
  return {
    axis,
    wide: move.wide,
    amount: INVERT_AMOUNT[move.amount],
  }
}

export const mirrorAlgorithm = (
  alg: Algorithm | string,
  plane: MirrorPlane = 'M',
): Algorithm => {
  const moves = typeof alg === 'string' ? parseAlgorithm(alg) : alg
  return moves.map((m) => mirrorMove(m, plane))
}
