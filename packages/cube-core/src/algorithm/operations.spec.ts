import { describe, expect, it } from 'vitest'

import { SOLVED_STATE, isSolved } from '../state/sticker-model'
import { parseAlgorithm, formatAlgorithm } from '../moves/parser'
import {
  applyAlgorithm,
  commutator,
  concat,
  conjugate,
  invertAlgorithm,
} from './operations'

describe('applyAlgorithm', () => {
  it('accepts a string', () => {
    const state = applyAlgorithm(SOLVED_STATE, 'R')
    expect(state).not.toBe(SOLVED_STATE)
  })

  it('accepts a parsed Algorithm', () => {
    const alg = parseAlgorithm("R U R'")
    const state = applyAlgorithm(SOLVED_STATE, alg)
    expect(state.length).toBe(54)
  })

  it('empty algorithm is identity', () => {
    expect(applyAlgorithm(SOLVED_STATE, '')).toBe(SOLVED_STATE)
    expect(applyAlgorithm(SOLVED_STATE, [])).toBe(SOLVED_STATE)
  })
})

describe('invertAlgorithm', () => {
  it('reverses and inverts each move', () => {
    const alg = invertAlgorithm("R U R' U'")
    expect(formatAlgorithm(alg)).toBe("U R U' R'")
  })

  it('accepts parsed input', () => {
    const parsed = parseAlgorithm("R U")
    const inverse = invertAlgorithm(parsed)
    expect(formatAlgorithm(inverse)).toBe("U' R'")
  })

  it('inverse of empty is empty', () => {
    expect(invertAlgorithm('')).toEqual([])
  })
})

describe('conjugate', () => {
  it('produces A B A_inverse', () => {
    const alg = conjugate('R', 'U')
    expect(formatAlgorithm(alg)).toBe("R U R'")
  })

  it('A B A_inverse on solved with self-inverse B returns to solved', () => {
    const alg = conjugate("R U R'", "U2")
    // A B A_inverse: with B = U2 (self-inverse), apply twice = solved.
    const state = applyAlgorithm(applyAlgorithm(SOLVED_STATE, alg), alg)
    expect(isSolved(state)).toBe(true)
  })

  it('accepts parsed inputs', () => {
    const alg = conjugate(parseAlgorithm('R'), parseAlgorithm('U'))
    expect(formatAlgorithm(alg)).toBe("R U R'")
  })
})

describe('commutator', () => {
  it('produces A B A_inverse B_inverse', () => {
    const alg = commutator('R', 'U')
    expect(formatAlgorithm(alg)).toBe("R U R' U'")
  })

  it('([R, U])^6 returns to solved (sexy move has order 6)', () => {
    const sexy = commutator('R', 'U')
    let state = SOLVED_STATE
    for (let i = 0; i < 6; i++) state = applyAlgorithm(state, sexy)
    expect(isSolved(state)).toBe(true)
  })

  it('accepts parsed inputs', () => {
    const alg = commutator(parseAlgorithm('R'), parseAlgorithm('U'))
    expect(alg.length).toBe(4)
  })
})

describe('concat', () => {
  it('joins multiple algorithms (mixed string/parsed)', () => {
    const alg = concat('R U', parseAlgorithm("R'"), '')
    expect(formatAlgorithm(alg)).toBe("R U R'")
  })

  it('concat of nothing is empty', () => {
    expect(concat()).toEqual([])
  })
})
