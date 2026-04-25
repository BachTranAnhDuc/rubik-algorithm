import { describe, expect, it } from 'vitest'

import { formatAlgorithm, parseAlgorithm } from './parser'
import { mirrorAlgorithm, mirrorMove } from './mirror'

describe('mirrorMove', () => {
  it('M-mirror swaps R↔L and inverts amount', () => {
    expect(mirrorMove({ axis: 'R', wide: false, amount: 1 }, 'M')).toEqual({
      axis: 'L',
      wide: false,
      amount: 3,
    })
    expect(mirrorMove({ axis: 'L', wide: false, amount: 2 }, 'M')).toEqual({
      axis: 'R',
      wide: false,
      amount: 2,
    })
  })

  it('M-mirror inverts U/D/F/B amounts but keeps axis', () => {
    expect(mirrorMove({ axis: 'U', wide: false, amount: 1 }, 'M')).toEqual({
      axis: 'U',
      wide: false,
      amount: 3,
    })
    expect(mirrorMove({ axis: 'F', wide: false, amount: 1 }, 'M')).toEqual({
      axis: 'F',
      wide: false,
      amount: 3,
    })
  })

  it('S-mirror swaps F↔B and inverts amount', () => {
    expect(mirrorMove({ axis: 'F', wide: false, amount: 1 }, 'S')).toEqual({
      axis: 'B',
      wide: false,
      amount: 3,
    })
  })

  it('E-mirror swaps U↔D and inverts amount', () => {
    expect(mirrorMove({ axis: 'U', wide: false, amount: 1 }, 'E')).toEqual({
      axis: 'D',
      wide: false,
      amount: 3,
    })
  })

  it('preserves wide flag', () => {
    expect(mirrorMove({ axis: 'R', wide: true, amount: 1 }, 'M')).toEqual({
      axis: 'L',
      wide: true,
      amount: 3,
    })
  })

  it('inverts slice and rotation amounts without changing axis', () => {
    expect(mirrorMove({ axis: 'M', wide: false, amount: 1 }, 'M')).toEqual({
      axis: 'M',
      wide: false,
      amount: 3,
    })
    expect(mirrorMove({ axis: 'y', wide: false, amount: 1 }, 'M')).toEqual({
      axis: 'y',
      wide: false,
      amount: 3,
    })
  })
})

describe('mirrorAlgorithm', () => {
  it('Sune mirrors to Anti-Sune across M', () => {
    const sune = "R U R' U R U2 R'"
    const mirrored = formatAlgorithm(mirrorAlgorithm(sune, 'M'))
    expect(mirrored).toBe("L' U' L U' L' U2 L")
  })

  it('default plane is M', () => {
    expect(mirrorAlgorithm("R U R'")).toEqual(mirrorAlgorithm("R U R'", 'M'))
  })

  it('accepts parsed input', () => {
    const alg = parseAlgorithm("R U R'")
    const mirrored = mirrorAlgorithm(alg, 'M')
    expect(formatAlgorithm(mirrored)).toBe("L' U' L")
  })

  it('mirror is an involution: mirror(mirror(x)) = x', () => {
    const alg = "R U R' F R F' U' Rw"
    const twice = mirrorAlgorithm(mirrorAlgorithm(alg, 'M'), 'M')
    expect(formatAlgorithm(twice)).toBe(alg)
  })

  it('empty algorithm mirrors to empty', () => {
    expect(mirrorAlgorithm('')).toEqual([])
  })
})
