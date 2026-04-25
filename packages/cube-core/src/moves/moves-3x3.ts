import type { Move, MoveAxis } from '../types'
import { cyclesToPermutation, type Cycle, composePermutations, invertPermutation, type Permutation } from './perm'

// Disjoint cycles of sticker indices for each base move.
// Cycle [a, b, c, d] means: a→b, b→c, c→d, d→a (sticker at a moves to b, etc.).
// All faces are oriented per the convention in `state/sticker-model.ts`.

// 90° clockwise looking AT each face from outside the cube.
const U_CYCLES: readonly Cycle[] = [
  [0, 2, 8, 6],
  [1, 5, 7, 3],
  [9, 36, 45, 18],
  [10, 37, 46, 19],
  [11, 38, 47, 20],
]

const D_CYCLES: readonly Cycle[] = [
  [27, 29, 35, 33],
  [28, 32, 34, 30],
  [15, 24, 51, 42],
  [44, 17, 26, 53],
  [16, 25, 52, 43],
]

const F_CYCLES: readonly Cycle[] = [
  [9, 11, 17, 15],
  [10, 14, 16, 12],
  [6, 18, 29, 44],
  [7, 21, 28, 41],
  [8, 24, 27, 38],
]

const B_CYCLES: readonly Cycle[] = [
  [45, 47, 53, 51],
  [46, 50, 52, 48],
  [2, 36, 33, 26],
  [20, 0, 42, 35],
  [1, 39, 34, 23],
]

const R_CYCLES: readonly Cycle[] = [
  [18, 20, 26, 24],
  [19, 23, 25, 21],
  [8, 45, 35, 17],
  [11, 2, 51, 29],
  [5, 48, 32, 14],
]

const L_CYCLES: readonly Cycle[] = [
  [36, 38, 44, 42],
  [37, 41, 43, 39],
  [6, 47, 33, 15],
  [9, 0, 53, 27],
  [3, 50, 30, 12],
]

// Slice moves. M follows L direction; E follows D direction; S follows F direction.
const M_CYCLES: readonly Cycle[] = [
  [7, 46, 34, 16],
  [10, 1, 52, 28],
  [4, 49, 31, 13],
]

const E_CYCLES: readonly Cycle[] = [
  [14, 23, 50, 41],
  [21, 48, 39, 12],
  [13, 22, 49, 40],
]

const S_CYCLES: readonly Cycle[] = [
  [5, 25, 30, 37],
  [19, 32, 43, 3],
  [4, 22, 31, 40],
]

const buildBase = (cycles: readonly Cycle[]): Permutation => cyclesToPermutation(cycles)

// Single-turn (90° CW) permutations for each axis.
const BASE_TURNS: Readonly<Record<MoveAxis, Permutation>> = (() => {
  const U = buildBase(U_CYCLES)
  const D = buildBase(D_CYCLES)
  const F = buildBase(F_CYCLES)
  const B = buildBase(B_CYCLES)
  const R = buildBase(R_CYCLES)
  const L = buildBase(L_CYCLES)
  const M = buildBase(M_CYCLES)
  const E = buildBase(E_CYCLES)
  const S = buildBase(S_CYCLES)

  // Rotations: x = R · M' · L', y = U · E' · D', z = F · S · B'.
  // Order doesn't matter for compose since the three slices are disjoint, but
  // composePermutations expects a fixed order; using right-to-left is fine.
  const xRot = composePermutations(R, composePermutations(invertPermutation(M), invertPermutation(L)))
  const yRot = composePermutations(U, composePermutations(invertPermutation(E), invertPermutation(D)))
  const zRot = composePermutations(F, composePermutations(S, invertPermutation(B)))

  return {
    U,
    D,
    F,
    B,
    R,
    L,
    M,
    E,
    S,
    x: xRot,
    y: yRot,
    z: zRot,
  }
})()

// Wide turns: outer face + adjacent middle slice in same direction.
//   Uw = U · E'   Dw = D · E    Fw = F · S    Bw = B · S'
//   Rw = R · M'   Lw = L · M
const WIDE_TURNS: Readonly<Record<'U' | 'D' | 'F' | 'B' | 'R' | 'L', Permutation>> = (() => {
  const U = composePermutations(BASE_TURNS.U, invertPermutation(BASE_TURNS.E))
  const D = composePermutations(BASE_TURNS.D, BASE_TURNS.E)
  const F = composePermutations(BASE_TURNS.F, BASE_TURNS.S)
  const B = composePermutations(BASE_TURNS.B, invertPermutation(BASE_TURNS.S))
  const R = composePermutations(BASE_TURNS.R, invertPermutation(BASE_TURNS.M))
  const L = composePermutations(BASE_TURNS.L, BASE_TURNS.M)
  return { U, D, F, B, R, L }
})()

// Resolve a (axis, wide) into the 90° CW permutation, before applying the amount.
const baseTurnFor = (axis: MoveAxis, wide: boolean): Permutation => {
  if (!wide) return BASE_TURNS[axis]
  if (axis === 'U' || axis === 'D' || axis === 'F' || axis === 'B' || axis === 'R' || axis === 'L') {
    return WIDE_TURNS[axis]
  }
  throw new Error(`wide modifier not valid for axis ${axis}`)
}

// Permutation for a single move including its amount.
//   amount 1 = base, 2 = base², 3 = base³ (= base⁻¹)
export const movePermutation = (move: Move): Permutation => {
  const base = baseTurnFor(move.axis, move.wide)
  if (move.amount === 1) return base
  if (move.amount === 2) return composePermutations(base, base)
  return invertPermutation(base) // amount 3
}

// Convenience export of the raw base-turn perms (single-step CW) — useful in tests.
export const baseTurns = BASE_TURNS
