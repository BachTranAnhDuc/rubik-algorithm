import { describe, expect, it } from 'vitest'

import { formatAlgorithm } from '../moves/parser'
import { mulberry32 } from './rng'
import { wcaScramble } from './wca-3x3'

describe('wcaScramble', () => {
  it('produces a sequence of the requested length', () => {
    const alg = wcaScramble({ length: 25, seed: 1 })
    expect(alg).toHaveLength(25)
  })

  it('default length is 25', () => {
    expect(wcaScramble({ seed: 1 })).toHaveLength(25)
  })

  it('is deterministic given a seed', () => {
    const a = wcaScramble({ seed: 42, length: 30 })
    const b = wcaScramble({ seed: 42, length: 30 })
    expect(formatAlgorithm(a)).toBe(formatAlgorithm(b))
  })

  it('different seeds produce different scrambles', () => {
    const a = wcaScramble({ seed: 1, length: 30 })
    const b = wcaScramble({ seed: 2, length: 30 })
    expect(formatAlgorithm(a)).not.toBe(formatAlgorithm(b))
  })

  it('uses only U/D/F/B/R/L face axes (no slices, rotations, wides)', () => {
    const alg = wcaScramble({ seed: 5, length: 100 })
    for (const move of alg) {
      expect(['U', 'D', 'F', 'B', 'R', 'L']).toContain(move.axis)
      expect(move.wide).toBe(false)
    }
  })

  it('never repeats the same face on consecutive moves', () => {
    const alg = wcaScramble({ seed: 9, length: 200 })
    for (let i = 1; i < alg.length; i++) {
      expect(alg[i]!.axis).not.toBe(alg[i - 1]!.axis)
    }
  })

  it('never produces three consecutive moves on the same axis', () => {
    const opposite: Record<string, string> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' }
    const alg = wcaScramble({ seed: 11, length: 500 })
    for (let i = 2; i < alg.length; i++) {
      const a = alg[i - 2]!.axis
      const b = alg[i - 1]!.axis
      const c = alg[i]!.axis
      const sameAxis = (x: string, y: string) => x === y || opposite[x] === y
      const triple = sameAxis(a, b) && sameAxis(b, c)
      expect(triple).toBe(false)
    }
  })

  it('accepts a custom rng', () => {
    const rng = mulberry32(7)
    const alg = wcaScramble({ rng, length: 20 })
    expect(alg).toHaveLength(20)
  })

  it('rejects negative length', () => {
    expect(() => wcaScramble({ length: -1, seed: 1 })).toThrow(/non-negative/)
  })

  it('returns empty for length 0', () => {
    expect(wcaScramble({ length: 0, seed: 1 })).toEqual([])
  })
})
