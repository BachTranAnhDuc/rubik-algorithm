import { describe, expect, it } from 'vitest'

import { mulberry32, randomChoice, randomInt } from './rng'

describe('mulberry32', () => {
  it('produces deterministic output for the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 10; i++) {
      expect(a()).toBeCloseTo(b(), 12)
    }
  })

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds produce different first values', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})

describe('randomInt', () => {
  it('returns integers in [0, max)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 100; i++) {
      const v = randomInt(rng, 6)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('rejects non-positive max', () => {
    expect(() => randomInt(mulberry32(1), 0)).toThrow(/positive/)
    expect(() => randomInt(mulberry32(1), -3)).toThrow(/positive/)
  })
})

describe('randomChoice', () => {
  it('returns one of the provided items', () => {
    const rng = mulberry32(123)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(randomChoice(rng, items))
    }
  })

  it('rejects empty input', () => {
    expect(() => randomChoice(mulberry32(1), [])).toThrow(/empty/)
  })
})
