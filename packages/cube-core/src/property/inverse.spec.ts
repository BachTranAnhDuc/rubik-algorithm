import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE } from '../state/sticker-model'

import { algArb } from './arbitraries'

describe('inverse property', () => {
  it("apply(alg) ∘ apply(invert(alg)) = identity (returns to solved)", () => {
    fc.assert(
      fc.property(algArb, (alg) => {
        const scrambled = applyAlgorithm(SOLVED_STATE, alg)
        const back = applyAlgorithm(scrambled, invertAlgorithm(alg))
        return back === SOLVED_STATE
      }),
      { numRuns: 100 },
    )
  })

  it('invert(invert(alg)) ≡ alg (apply-equivalent)', () => {
    fc.assert(
      fc.property(algArb, (alg) => {
        const twice = invertAlgorithm(invertAlgorithm(alg))
        return applyAlgorithm(SOLVED_STATE, twice) === applyAlgorithm(SOLVED_STATE, alg)
      }),
      { numRuns: 100 },
    )
  })
})
