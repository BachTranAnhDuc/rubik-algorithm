import { describe, expect, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE } from '../state/sticker-model'

import {
  F2L_ALGORITHMS,
  F2L_CANONICAL_STATES,
  F2L_IDS,
  recognizeF2l,
} from './f2l'

describe('F2L_IDS / F2L_ALGORITHMS', () => {
  it('all canonical states are pairwise-distinct under AUF normalization', () => {
    expect(F2L_CANONICAL_STATES.size).toBe(F2L_IDS.length)
  })
})

describe('recognizeF2l', () => {
  it('returns null for solved state', () => {
    expect(recognizeF2l(SOLVED_STATE)).toBeNull()
  })

  it.each(Array.from(F2L_IDS))(
    'recognizes %s case state',
    (id) => {
      const caseState = applyAlgorithm(SOLVED_STATE, invertAlgorithm(F2L_ALGORITHMS[id]!))
      const result = recognizeF2l(caseState)
      expect(result).not.toBeNull()
      expect(result!.caseId).toBe(id)
    },
  )

  it('AUF-normalizes (recognizes after a U2 turn)', () => {
    const caseState = applyAlgorithm(SOLVED_STATE, invertAlgorithm(F2L_ALGORITHMS.F2L1!))
    const aufed = applyAlgorithm(caseState, 'U2')
    const result = recognizeF2l(aufed)
    expect(result).not.toBeNull()
    expect(result!.caseId).toBe('F2L1')
  })
})
