import { describe, expect, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE, isSolved } from '../state/sticker-model'

import {
  PLL_ALGORITHMS,
  PLL_CANONICAL_STATES,
  PLL_IDS,
  recognizePll,
  type PllId,
} from './pll'

describe('PLL_IDS / PLL_ALGORITHMS', () => {
  it('contains all 21 PLLs', () => {
    expect(PLL_IDS).toHaveLength(21)
  })

  it('canonical states are unique', () => {
    expect(PLL_CANONICAL_STATES.size).toBe(21)
  })
})

describe('PLL canonical states', () => {
  it.each(Array.from(PLL_IDS))(
    '%s applied to its case state yields solved',
    (id) => {
      const alg = PLL_ALGORITHMS[id]
      const caseState = applyAlgorithm(SOLVED_STATE, invertAlgorithm(alg))
      const solved = applyAlgorithm(caseState, alg)
      expect(isSolved(solved)).toBe(true)
    },
  )
})

describe('recognizePll', () => {
  it.each(Array.from(PLL_IDS))(
    'recognizes %s case state',
    (id) => {
      const caseState = applyAlgorithm(SOLVED_STATE, invertAlgorithm(PLL_ALGORITHMS[id]))
      const result = recognizePll(caseState)
      expect(result).not.toBeNull()
      expect(result!.caseId).toBe(id as PllId)
    },
  )

  it('recognizes case state after AUF rotation', () => {
    const tperm = applyAlgorithm(SOLVED_STATE, invertAlgorithm(PLL_ALGORITHMS.T))
    const aufed = applyAlgorithm(tperm, 'U')
    const result = recognizePll(aufed)
    expect(result).not.toBeNull()
    expect(result!.caseId).toBe('T')
    expect(result!.auf).toBe(3)
  })

  it('recognizes case state after y rotation', () => {
    const tperm = applyAlgorithm(SOLVED_STATE, invertAlgorithm(PLL_ALGORITHMS.T))
    const rotated = applyAlgorithm(tperm, 'y')
    const result = recognizePll(rotated)
    expect(result).not.toBeNull()
    expect(result!.caseId).toBe('T')
  })

  it('returns null for solved (no PLL pattern)', () => {
    expect(recognizePll(SOLVED_STATE)).toBeNull()
  })
})
