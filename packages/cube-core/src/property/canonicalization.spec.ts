import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { normalize } from '../algorithm/normalize'
import { applyAlgorithm } from '../algorithm/operations'
import { cancelMoves } from '../moves/cancel'
import { formatAlgorithm } from '../moves/parser'
import { SOLVED_STATE } from '../state/sticker-model'

import { algArb } from './arbitraries'

describe('normalize / cancel canonicalization', () => {
  it('normalize is behavior-preserving', () => {
    fc.assert(
      fc.property(algArb, (alg) => {
        const original = applyAlgorithm(SOLVED_STATE, alg)
        const normalized = applyAlgorithm(SOLVED_STATE, normalize(alg))
        return original === normalized
      }),
      { numRuns: 100 },
    )
  })

  it('normalize is idempotent: normalize(normalize(alg)) = normalize(alg)', () => {
    fc.assert(
      fc.property(algArb, (alg) => {
        const once = normalize(alg)
        const twice = normalize(once)
        return formatAlgorithm(twice) === formatAlgorithm(once)
      }),
      { numRuns: 100 },
    )
  })

  it('cancel(normalize(alg)) = cancel(alg)', () => {
    fc.assert(
      fc.property(algArb, (alg) => {
        const left = formatAlgorithm(cancelMoves(normalize(alg)))
        const right = formatAlgorithm(cancelMoves(alg))
        return left === right
      }),
      { numRuns: 100 },
    )
  })
})
