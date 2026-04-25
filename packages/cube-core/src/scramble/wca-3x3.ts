import type { Algorithm, Face, Move, MoveAmount } from '../types'

import type { Random } from './rng'
import { defaultRandom, mulberry32, randomInt } from './rng'

const FACES: readonly Face[] = ['U', 'D', 'F', 'B', 'R', 'L']
const AMOUNTS: readonly MoveAmount[] = [1, 2, 3]

const OPPOSITE: Readonly<Record<Face, Face>> = {
  U: 'D',
  D: 'U',
  F: 'B',
  B: 'F',
  R: 'L',
  L: 'R',
}

export interface WcaScrambleOptions {
  readonly length?: number
  readonly seed?: number
  readonly rng?: Random
}

const DEFAULT_LENGTH = 25

// Generates a WCA-style scramble: random face turns from {U,D,F,B,R,L} with
// the standard restrictions:
//   • No two consecutive moves on the same face (R then R combines).
//   • No three consecutive moves on the same axis (R L R simplifies via
//     parallel-face commutation).
// Wides, slices, and rotations are deliberately excluded — WCA scrambles use
// only the six face turns.
export const wcaScramble = (opts: WcaScrambleOptions = {}): Algorithm => {
  const length = opts.length ?? DEFAULT_LENGTH
  if (length < 0) throw new Error(`scramble length must be non-negative, got ${length}`)
  const rng =
    opts.rng ??
    (opts.seed !== undefined ? mulberry32(opts.seed) : defaultRandom)

  const moves: Move[] = []
  while (moves.length < length) {
    const face = FACES[randomInt(rng, FACES.length)]!
    const last = moves[moves.length - 1]
    const prev = moves[moves.length - 2]

    if (last && (last.axis === face || last.axis === OPPOSITE[face])) {
      if (last.axis === face) continue
      if (prev && (prev.axis === face || prev.axis === OPPOSITE[face])) continue
    }

    const amount = AMOUNTS[randomInt(rng, AMOUNTS.length)]!
    moves.push({ axis: face, wide: false, amount })
  }

  return moves
}
