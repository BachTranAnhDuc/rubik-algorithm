import { describe, expect, it } from 'vitest'

import {
  applyPermutation,
  composePermutations,
  cyclesToPermutation,
  identityPermutation,
  invertPermutation,
  powerPermutation,
} from './perm'

describe('cyclesToPermutation', () => {
  it('builds an identity for empty cycles', () => {
    const p = cyclesToPermutation([], 5)
    expect(p).toEqual([0, 1, 2, 3, 4])
  })

  it('builds the right permutation for a 3-cycle', () => {
    // Cycle [0, 1, 2]: 0→1, 1→2, 2→0. perm[1]=0, perm[2]=1, perm[0]=2.
    const p = cyclesToPermutation([[0, 1, 2]], 3)
    expect(p).toEqual([2, 0, 1])
  })

  it('skips degenerate cycles of length < 2', () => {
    const p = cyclesToPermutation([[0]], 3)
    expect(p).toEqual([0, 1, 2])
  })
})

describe('applyPermutation', () => {
  it('shuffles a string per perm', () => {
    // perm [2, 0, 1] means new[0]=old[2], new[1]=old[0], new[2]=old[1].
    expect(applyPermutation('abc', [2, 0, 1])).toBe('cab')
  })

  it('throws on length mismatch', () => {
    expect(() => applyPermutation('ab', [0, 1, 2])).toThrow(/length/)
  })
})

describe('composePermutations', () => {
  it('matches sequential application', () => {
    const p = cyclesToPermutation([[0, 1, 2]], 3)
    const composed = composePermutations(p, p)
    const direct = applyPermutation(applyPermutation('abc', p), p)
    const viaComposed = applyPermutation('abc', composed)
    expect(viaComposed).toBe(direct)
  })

  it('throws on length mismatch', () => {
    expect(() => composePermutations([0, 1], [0, 1, 2])).toThrow(/length/)
  })
})

describe('invertPermutation', () => {
  it('produces the inverse', () => {
    const p = cyclesToPermutation([[0, 1, 2, 3]], 4)
    const inv = invertPermutation(p)
    expect(applyPermutation(applyPermutation('abcd', p), inv)).toBe('abcd')
  })
})

describe('powerPermutation', () => {
  it('returns identity for n=0', () => {
    const p = cyclesToPermutation([[0, 1, 2]], 3)
    expect(powerPermutation(p, 0)).toEqual(identityPermutation(3))
  })

  it('returns the perm itself for n=1', () => {
    const p = cyclesToPermutation([[0, 1, 2]], 3)
    expect(powerPermutation(p, 1)).toEqual(p)
  })

  it('matches sequential composition for n>1', () => {
    const p = cyclesToPermutation([[0, 1, 2, 3]], 4)
    const p3 = powerPermutation(p, 3)
    const direct = composePermutations(p, composePermutations(p, p))
    expect(p3).toEqual(direct)
  })

  it('throws on negative n', () => {
    expect(() => powerPermutation([0, 1], -1)).toThrow(/non-negative/)
  })
})
