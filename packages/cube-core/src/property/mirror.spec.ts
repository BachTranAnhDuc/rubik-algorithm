import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { mirrorAlgorithm } from '../moves/mirror'
import { formatAlgorithm } from '../moves/parser'

import { algArb } from './arbitraries'

describe('mirror property', () => {
  it.each(['M', 'S', 'E'] as const)(
    'mirror_%s is an involution: mirror(mirror(alg)) = alg',
    (plane) => {
      fc.assert(
        fc.property(algArb, (alg) => {
          const twice = mirrorAlgorithm(mirrorAlgorithm(alg, plane), plane)
          return formatAlgorithm(twice) === formatAlgorithm(alg)
        }),
        { numRuns: 100 },
      )
    },
  )
})
