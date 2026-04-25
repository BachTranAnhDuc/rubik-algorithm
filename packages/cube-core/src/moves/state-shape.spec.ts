import { describe, expect, it } from 'vitest'

import { SOLVED_STATE } from '../state/sticker-model'
import { applyAlgorithm } from '../algorithm/operations'

// Apply each base move once to the solved state and assert the resulting
// sticker string matches what we hand-derived. If any of these mismatch the
// move table is wrong.

describe('single-move state shapes (from solved)', () => {
  it('U → expected layout', () => {
    // U rotates U face stickers (still all U after rotation), and shifts side
    // top rows around: F[top] gets R[top] (still R), R[top] gets B[top], etc.
    // After U on solved, stickers stay at their face colors except the side
    // top rows get a different face's color.
    //
    //   F[top] ← R[top] = R
    //   L[top] ← F[top] = F
    //   B[top] ← L[top] = L
    //   R[top] ← B[top] = B
    const state = applyAlgorithm(SOLVED_STATE, 'U')
    // U face all U.
    expect(state.slice(0, 9)).toBe('UUUUUUUUU')
    // F top row = R.
    expect(state.slice(9, 12)).toBe('RRR')
    // R top row = B.
    expect(state.slice(18, 21)).toBe('BBB')
    // L top row = F.
    expect(state.slice(36, 39)).toBe('FFF')
    // B top row = L.
    expect(state.slice(45, 48)).toBe('LLL')
  })

  it('R → expected layout', () => {
    // R cycles U-right-col → F-right-col → D-right-col → B-left-col → U-right-col.
    // After one R from solved: U-right is replaced by F's right column (= F);
    // F-right by D's right column (= D); D-right by B's left column (= B);
    // B-left by U's right column (= U).
    const state = applyAlgorithm(SOLVED_STATE, 'R')
    // U right column (indices 2, 5, 8) ← F right column = 'F'.
    expect(state[2]).toBe('F')
    expect(state[5]).toBe('F')
    expect(state[8]).toBe('F')
    // F right column ← D right column = 'D'.
    expect(state[11]).toBe('D')
    expect(state[14]).toBe('D')
    expect(state[17]).toBe('D')
    // D right column ← B left column = 'B'.
    expect(state[29]).toBe('B')
    expect(state[32]).toBe('B')
    expect(state[35]).toBe('B')
    // B left column ← U right column = 'U'.
    expect(state[45]).toBe('U')
    expect(state[48]).toBe('U')
    expect(state[51]).toBe('U')
  })

  it('F → expected layout', () => {
    // F cycles U-bottom row, R-left column, D-top row, L-right column.
    // From the cycles: F-bottom moves U[6,7,8] → R[0,3,6] → D[0,1,2] (reversed) → L[2,5,8] → U[6,7,8].
    // Specifically, new R-left col ← U-bottom row = 'U'.
    const state = applyAlgorithm(SOLVED_STATE, 'F')
    // U bottom row ← L right column = 'L'.
    expect(state[6]).toBe('L')
    expect(state[7]).toBe('L')
    expect(state[8]).toBe('L')
    // R left column ← U bottom row = 'U'.
    expect(state[18]).toBe('U')
    expect(state[21]).toBe('U')
    expect(state[24]).toBe('U')
    // D top row ← R left column = 'R'.
    expect(state[27]).toBe('R')
    expect(state[28]).toBe('R')
    expect(state[29]).toBe('R')
    // L right column ← D top row = 'D'.
    expect(state[38]).toBe('D')
    expect(state[41]).toBe('D')
    expect(state[44]).toBe('D')
  })
})
