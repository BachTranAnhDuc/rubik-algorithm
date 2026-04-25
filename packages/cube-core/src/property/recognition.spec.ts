import { describe, expect, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { OLL_ALGORITHMS, OLL_IDS, recognizeOll } from '../recognition/oll'
import { PLL_ALGORITHMS, PLL_IDS, recognizePll } from '../recognition/pll'
import { SOLVED_STATE } from '../state/sticker-model'

describe('recognition round-trip (PLL)', () => {
  it.each(Array.from(PLL_IDS))(
    'scramble into %s + AUF + y rotation → recognize matches',
    (id) => {
      const caseState = applyAlgorithm(
        SOLVED_STATE,
        invertAlgorithm(PLL_ALGORITHMS[id]),
      )
      for (const setup of ['', 'U', 'U2', "U'", 'y', 'y2', "y'", "U y'"]) {
        const transformed =
          setup === '' ? caseState : applyAlgorithm(caseState, setup)
        const result = recognizePll(transformed)
        expect(result, `failed at setup "${setup}"`).not.toBeNull()
        expect(result!.caseId, `failed at setup "${setup}"`).toBe(id)
      }
    },
  )
})

describe('recognition round-trip (OLL)', () => {
  it.each(Array.from(OLL_IDS))(
    'scramble into %s + AUF + y rotation → recognize matches',
    (id) => {
      const caseState = applyAlgorithm(
        SOLVED_STATE,
        invertAlgorithm(OLL_ALGORITHMS[id]!),
      )
      for (const setup of ['', 'U', 'U2', "U'", 'y', 'y2', "y'"]) {
        const transformed =
          setup === '' ? caseState : applyAlgorithm(caseState, setup)
        const result = recognizeOll(transformed)
        expect(result, `failed at setup "${setup}"`).not.toBeNull()
        expect(result!.caseId, `failed at setup "${setup}"`).toBe(id)
      }
    },
  )
})
