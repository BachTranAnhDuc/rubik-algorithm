import { describe, expect, it } from 'vitest'

import { formatAlgorithm, formatMove, parseAlgorithm } from './parser'

describe('parseAlgorithm', () => {
  it('parses a typical sequence', () => {
    const alg = parseAlgorithm("R U R' U'")
    expect(alg).toEqual([
      { axis: 'R', wide: false, amount: 1 },
      { axis: 'U', wide: false, amount: 1 },
      { axis: 'R', wide: false, amount: 3 },
      { axis: 'U', wide: false, amount: 3 },
    ])
  })

  it('parses wides and doubles', () => {
    const alg = parseAlgorithm('Rw2 Uw')
    expect(alg).toEqual([
      { axis: 'R', wide: true, amount: 2 },
      { axis: 'U', wide: true, amount: 1 },
    ])
  })

  it('parses lowercase wide shorthand identically to Xw', () => {
    expect(parseAlgorithm("r u' f2 b' l d")).toEqual([
      { axis: 'R', wide: true, amount: 1 },
      { axis: 'U', wide: true, amount: 3 },
      { axis: 'F', wide: true, amount: 2 },
      { axis: 'B', wide: true, amount: 3 },
      { axis: 'L', wide: true, amount: 1 },
      { axis: 'D', wide: true, amount: 1 },
    ])
    expect(parseAlgorithm('r')).toEqual(parseAlgorithm('Rw'))
    expect(parseAlgorithm("u'")).toEqual(parseAlgorithm("Uw'"))
  })

  it('parses slices and rotations', () => {
    const alg = parseAlgorithm("M' E S2 x y' z2")
    expect(alg).toEqual([
      { axis: 'M', wide: false, amount: 3 },
      { axis: 'E', wide: false, amount: 1 },
      { axis: 'S', wide: false, amount: 2 },
      { axis: 'x', wide: false, amount: 1 },
      { axis: 'y', wide: false, amount: 3 },
      { axis: 'z', wide: false, amount: 2 },
    ])
  })

  it('returns empty for whitespace-only input', () => {
    expect(parseAlgorithm('')).toEqual([])
    expect(parseAlgorithm('   ')).toEqual([])
  })

  it('rejects garbage tokens', () => {
    expect(() => parseAlgorithm('R Q')).toThrow(/invalid move token/)
    expect(() => parseAlgorithm('R3')).toThrow(/invalid move token/)
    expect(() => parseAlgorithm('M w')).toThrow(/invalid move token/)
    expect(() => parseAlgorithm('m')).toThrow(/invalid move token/) // lowercase slice not allowed
    expect(() => parseAlgorithm('X')).toThrow(/invalid move token/) // uppercase rotation not allowed
  })
})

describe('formatMove / formatAlgorithm', () => {
  it('formats single moves', () => {
    expect(formatMove({ axis: 'R', wide: false, amount: 1 })).toBe('R')
    expect(formatMove({ axis: 'R', wide: false, amount: 2 })).toBe('R2')
    expect(formatMove({ axis: 'R', wide: false, amount: 3 })).toBe("R'")
    expect(formatMove({ axis: 'R', wide: true, amount: 1 })).toBe('Rw')
  })

  it('does not add wide modifier on slice/rotation axes', () => {
    expect(formatMove({ axis: 'M', wide: true as boolean, amount: 1 })).toBe('M')
    expect(formatMove({ axis: 'x', wide: true as boolean, amount: 1 })).toBe('x')
  })

  it('formats and re-parses to the same algorithm', () => {
    const alg = parseAlgorithm("R U R' U' Rw2 M E' S2 x y'")
    const formatted = formatAlgorithm(alg)
    const reparsed = parseAlgorithm(formatted)
    expect(reparsed).toEqual(alg)
  })
})
