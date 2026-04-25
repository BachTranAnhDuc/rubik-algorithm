import { describe, expect, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE, isSolved } from '../state/sticker-model'

import {
  OLL_ALGORITHMS,
  OLL_CANONICAL_STATES,
  OLL_IDS,
  recognizeOll,
} from './oll'

describe('OLL_IDS / OLL_ALGORITHMS', () => {
  it('contains all 57 OLLs', () => {
    expect(OLL_IDS).toHaveLength(57)
  })

  it('canonical states are unique (no two OLL algs produce the same state)', () => {
    expect(OLL_CANONICAL_STATES.size).toBe(57)
  })
})

describe('OLL canonical states', () => {
  it.each(Array.from(OLL_IDS))(
    '%s applied to its case state yields solved',
    (id) => {
      const alg = OLL_ALGORITHMS[id]!
      const caseState = applyAlgorithm(SOLVED_STATE, invertAlgorithm(alg))
      const solved = applyAlgorithm(caseState, alg)
      expect(isSolved(solved)).toBe(true)
    },
  )
})

describe('recognizeOll', () => {
  it.each(Array.from(OLL_IDS))(
    'recognizes %s case state',
    (id) => {
      const caseState = applyAlgorithm(SOLVED_STATE, invertAlgorithm(OLL_ALGORITHMS[id]!))
      const result = recognizeOll(caseState)
      expect(result).not.toBeNull()
      expect(result!.caseId).toBe(id)
    },
  )

  it('recognizes case state after AUF + y rotation', () => {
    const sune = applyAlgorithm(SOLVED_STATE, invertAlgorithm(OLL_ALGORITHMS.OLL27!))
    const transformed = applyAlgorithm(sune, "U y'")
    const result = recognizeOll(transformed)
    expect(result).not.toBeNull()
    expect(result!.caseId).toBe('OLL27')
  })

  it('returns null for solved state', () => {
    expect(recognizeOll(SOLVED_STATE)).toBeNull()
  })
})
