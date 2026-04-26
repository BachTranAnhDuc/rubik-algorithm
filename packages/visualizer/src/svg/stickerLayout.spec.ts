import { SOLVED_STATE } from '@rubik/cube-core'
import { describe, expect, it } from 'vitest'

import {
  F2L_SLOT_LAYOUT,
  TOP_VIEW_GRID_SIZE,
  TOP_VIEW_LAYOUT,
  stickersFromState,
} from './stickerLayout'

describe('TOP_VIEW_LAYOUT', () => {
  it('contains 21 cells (9 U + 12 strip stickers)', () => {
    expect(TOP_VIEW_LAYOUT).toHaveLength(21)
  })

  it('every cell falls inside the 5×5 grid', () => {
    for (const cell of TOP_VIEW_LAYOUT) {
      expect(cell.col).toBeGreaterThanOrEqual(0)
      expect(cell.col).toBeLessThan(TOP_VIEW_GRID_SIZE)
      expect(cell.row).toBeGreaterThanOrEqual(0)
      expect(cell.row).toBeLessThan(TOP_VIEW_GRID_SIZE)
    }
  })

  it('every state index is within 0..53', () => {
    for (const cell of TOP_VIEW_LAYOUT) {
      expect(cell.stateIndex).toBeGreaterThanOrEqual(0)
      expect(cell.stateIndex).toBeLessThan(54)
    }
  })

  it('each (col, row) appears exactly once', () => {
    const seen = new Set<string>()
    for (const cell of TOP_VIEW_LAYOUT) {
      const key = `${cell.col},${cell.row}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('U center sits at (2, 2) and reads U[4] = state index 4', () => {
    const center = TOP_VIEW_LAYOUT.find((c) => c.col === 2 && c.row === 2)!
    expect(center.stateIndex).toBe(4)
  })

  it('B-strip stickers are mirrored (B[2], B[1], B[0] left-to-right)', () => {
    const left = TOP_VIEW_LAYOUT.find((c) => c.col === 1 && c.row === 0)!
    const mid = TOP_VIEW_LAYOUT.find((c) => c.col === 2 && c.row === 0)!
    const right = TOP_VIEW_LAYOUT.find((c) => c.col === 3 && c.row === 0)!
    expect(left.stateIndex).toBe(45 + 2)
    expect(mid.stateIndex).toBe(45 + 1)
    expect(right.stateIndex).toBe(45 + 0)
  })
})

describe('stickersFromState', () => {
  it('returns one rendered sticker per layout cell', () => {
    const stickers = stickersFromState(SOLVED_STATE)
    expect(stickers).toHaveLength(TOP_VIEW_LAYOUT.length)
  })

  it('on solved state, U-face cells render the U character', () => {
    const stickers = stickersFromState(SOLVED_STATE)
    const center = stickers.find((s) => s.col === 2 && s.row === 2)!
    expect(center.character).toBe('U')
  })

  it('on solved state, F-strip renders F characters', () => {
    const stickers = stickersFromState(SOLVED_STATE)
    const fStrip = stickers.filter((s) => s.row === 4)
    expect(fStrip).toHaveLength(3)
    for (const s of fStrip) expect(s.character).toBe('F')
  })

  it('rejects wrong-length state', () => {
    expect(() => stickersFromState('U'.repeat(53))).toThrow(/54 characters/)
  })

  it('accepts a custom layout (e.g. F2L)', () => {
    const stickers = stickersFromState(SOLVED_STATE, F2L_SLOT_LAYOUT)
    expect(stickers).toHaveLength(F2L_SLOT_LAYOUT.length)
  })
})
