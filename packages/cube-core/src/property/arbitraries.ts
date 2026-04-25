import * as fc from 'fast-check'

import type { Move, MoveAmount, MoveAxis } from '../types'

const ALL_AXES: readonly MoveAxis[] = [
  'U', 'D', 'F', 'B', 'R', 'L',
  'M', 'E', 'S',
  'x', 'y', 'z',
]

const FACE_AXES: readonly MoveAxis[] = ['U', 'D', 'F', 'B', 'R', 'L']

const AMOUNTS: readonly MoveAmount[] = [1, 2, 3]

export const moveArb = fc
  .tuple(
    fc.constantFrom<MoveAxis>(...ALL_AXES),
    fc.constantFrom<MoveAmount>(...AMOUNTS),
    fc.boolean(),
  )
  .map(([axis, amount, wide]): Move => ({
    axis,
    amount,
    wide: wide && (FACE_AXES as readonly MoveAxis[]).includes(axis),
  }))

export const algArb = fc.array(moveArb, { minLength: 0, maxLength: 30 })
