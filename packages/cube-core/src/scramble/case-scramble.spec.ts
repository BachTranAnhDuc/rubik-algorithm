import { describe, expect, it } from 'vitest'

import { applyAlgorithm } from '../algorithm/operations'
import { isSolved, SOLVED_STATE } from '../state/sticker-model'
import { formatAlgorithm } from '../moves/parser'

import { scrambleIntoCase, stateForCase } from './case-scramble'

describe('scrambleIntoCase', () => {
  it('returns the inverse of the input', () => {
    expect(formatAlgorithm(scrambleIntoCase("R U R'"))).toBe("R U' R'")
  })

  it("when applied to solved, leaves a state that the original alg solves", () => {
    const solving = "R U R' U' R' F R2 U' R' U' R U R' F'"
    const scramble = scrambleIntoCase(solving)
    const scrambled = applyAlgorithm(SOLVED_STATE, scramble)
    const solved = applyAlgorithm(scrambled, solving)
    expect(isSolved(solved)).toBe(true)
  })
})

describe('stateForCase', () => {
  it('matches scrambleIntoCase + apply', () => {
    const alg = "R U R'"
    expect(stateForCase(alg)).toBe(applyAlgorithm(SOLVED_STATE, scrambleIntoCase(alg)))
  })

  it('round-trips: applying the solving alg returns to solved', () => {
    const solving = "R U R' U R U2 R'"
    const cased = stateForCase(solving)
    expect(isSolved(applyAlgorithm(cased, solving))).toBe(true)
  })
})
