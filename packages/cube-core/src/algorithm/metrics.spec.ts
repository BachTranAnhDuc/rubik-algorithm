import { describe, expect, it } from 'vitest'

import { parseAlgorithm } from '../moves/parser'
import { etm, htm, qtm, stm } from './metrics'

describe('htm (Half-Turn Metric)', () => {
  it('counts only face/wide turns, not slices or rotations', () => {
    const alg = parseAlgorithm("R U R' U' M E S x y z")
    expect(htm(alg)).toBe(4)
  })

  it('counts a double turn as 1', () => {
    const alg = parseAlgorithm('R2 U2')
    expect(htm(alg)).toBe(2)
  })

  it('returns 0 for empty', () => {
    expect(htm([])).toBe(0)
  })

  it('counts wides as face turns', () => {
    const alg = parseAlgorithm("Rw Uw'")
    expect(htm(alg)).toBe(2)
  })
})

describe('stm (Slice Turn Metric)', () => {
  it('counts faces, wides, and slices, but not rotations', () => {
    const alg = parseAlgorithm("R U M E S x y z")
    expect(stm(alg)).toBe(5)
  })
})

describe('etm (Execution Turn Metric)', () => {
  it('counts every move including rotations', () => {
    const alg = parseAlgorithm("R U M x y")
    expect(etm(alg)).toBe(5)
  })
})

describe('qtm (Quarter-Turn Metric)', () => {
  it('counts a 180° face turn as 2 and a quarter turn as 1', () => {
    const alg = parseAlgorithm("R U2 R'")
    expect(qtm(alg)).toBe(4)
  })

  it('ignores slices and rotations', () => {
    const alg = parseAlgorithm("M E S x y z")
    expect(qtm(alg)).toBe(0)
  })
})
