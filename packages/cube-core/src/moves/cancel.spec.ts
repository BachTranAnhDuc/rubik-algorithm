import { describe, expect, it } from 'vitest'

import { cancelMoves } from './cancel'
import { formatAlgorithm } from './parser'

describe('cancelMoves', () => {
  it('R R = R2', () => {
    expect(formatAlgorithm(cancelMoves('R R'))).toBe('R2')
  })

  it("R R' = empty", () => {
    expect(cancelMoves("R R'")).toEqual([])
  })

  it('R2 R = R\'', () => {
    expect(formatAlgorithm(cancelMoves('R2 R'))).toBe("R'")
  })

  it("R2 R2 = empty", () => {
    expect(cancelMoves('R2 R2')).toEqual([])
  })

  it("cascades: R U U' R' = empty", () => {
    expect(cancelMoves("R U U' R'")).toEqual([])
  })

  it("cascades: R U2 U2 R' = empty", () => {
    expect(cancelMoves("R U2 U2 R'")).toEqual([])
  })

  it("does not merge parallel different faces (R L stays R L)", () => {
    expect(formatAlgorithm(cancelMoves('R L'))).toBe('R L')
  })

  it('does not merge wide and non-wide of same axis', () => {
    expect(formatAlgorithm(cancelMoves('R Rw'))).toBe('R Rw')
  })

  it("preserves order: R U' R' U", () => {
    expect(formatAlgorithm(cancelMoves("R U' R' U"))).toBe("R U' R' U")
  })

  it('accepts parsed input', () => {
    expect(cancelMoves([{ axis: 'R', wide: false, amount: 1 }, { axis: 'R', wide: false, amount: 3 }])).toEqual([])
  })
})
