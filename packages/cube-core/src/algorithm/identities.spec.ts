import { describe, expect, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from './operations'
import { SOLVED_STATE, isSolved } from '../state/sticker-model'

// Property-style tests against well-known cube identities. These collectively
// verify the correctness of the move tables in `moves/moves-3x3.ts`.

describe('basic move orders', () => {
  for (const move of ['U', 'D', 'F', 'B', 'R', 'L', 'M', 'E', 'S']) {
    it(`${move} repeated 4 times returns to solved`, () => {
      const state = applyAlgorithm(SOLVED_STATE, `${move} ${move} ${move} ${move}`)
      expect(isSolved(state)).toBe(true)
    })
  }

  for (const move of ['x', 'y', 'z']) {
    it(`${move} repeated 4 times returns to solved`, () => {
      const state = applyAlgorithm(SOLVED_STATE, `${move} ${move} ${move} ${move}`)
      expect(isSolved(state)).toBe(true)
    })
  }

  for (const move of ['Uw', 'Dw', 'Fw', 'Bw', 'Rw', 'Lw']) {
    it(`${move} repeated 4 times returns to solved`, () => {
      const state = applyAlgorithm(SOLVED_STATE, `${move} ${move} ${move} ${move}`)
      expect(isSolved(state)).toBe(true)
    })
  }
})

describe('double-turn idempotence', () => {
  for (const move of ['U2', 'R2', 'F2', 'D2', 'L2', 'B2', 'M2', 'E2', 'S2']) {
    it(`${move} ${move} returns to solved`, () => {
      const state = applyAlgorithm(SOLVED_STATE, `${move} ${move}`)
      expect(isSolved(state)).toBe(true)
    })
  }
})

describe("inverses", () => {
  for (const move of ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z']) {
    it(`${move} ${move}' returns to solved`, () => {
      const state = applyAlgorithm(SOLVED_STATE, `${move} ${move}'`)
      expect(isSolved(state)).toBe(true)
    })
  }
})

describe('cube identities', () => {
  it('(R U R\' U\') × 6 returns to solved (sexy move has order 6)', () => {
    const seq = "R U R' U' ".repeat(6).trim()
    const state = applyAlgorithm(SOLVED_STATE, seq)
    expect(isSolved(state)).toBe(true)
  })

  it('Sune × 6 returns to solved', () => {
    // Sune: R U R' U R U2 R'  (order 6)
    const sune = "R U R' U R U2 R' "
    const state = applyAlgorithm(SOLVED_STATE, sune.repeat(6).trim())
    expect(isSolved(state)).toBe(true)
  })

  it('T-perm × 2 returns to solved (T-perm has order 2)', () => {
    const tperm = "R U R' U' R' F R2 U' R' U' R U R' F'"
    const state = applyAlgorithm(SOLVED_STATE, `${tperm} ${tperm}`)
    expect(isSolved(state)).toBe(true)
  })

  it("(M' U M' U M' U2 M U M U M U2) returns to solved (H-perm × 2; order 2)", () => {
    // H-perm flavor with M-slices; pure M moves order test.
    // Use M2 U M2 U2 M2 U M2 = H-perm via M-slices, applied twice.
    const hperm = 'M2 U M2 U2 M2 U M2'
    const state = applyAlgorithm(SOLVED_STATE, `${hperm} ${hperm}`)
    expect(isSolved(state)).toBe(true)
  })
})

describe('algorithm + inverse = identity (random sequences)', () => {
  // Deterministic spot-check across a broad set of moves.
  const samples = [
    "R U R' U'",
    "F R U R' U' F'",
    "R U2 R' U' R U' R'",
    "R U R' F' R U R' U' R' F R2 U' R'",
    "Rw U Rw'",
    "M U M' U M U2 M' U",
    "x y z R U R'",
  ]
  for (const s of samples) {
    it(`${s} ∘ inverse = identity`, () => {
      const inverse = invertAlgorithm(s)
      const state = applyAlgorithm(applyAlgorithm(SOLVED_STATE, s), inverse)
      expect(isSolved(state)).toBe(true)
    })
  }
})
