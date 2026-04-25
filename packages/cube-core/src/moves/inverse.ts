import type { Move, MoveAmount } from '../types'

const INVERSE_AMOUNT: Readonly<Record<MoveAmount, MoveAmount>> = { 1: 3, 2: 2, 3: 1 }

export const invertMove = (move: Move): Move => ({
  axis: move.axis,
  wide: move.wide,
  amount: INVERSE_AMOUNT[move.amount],
})
