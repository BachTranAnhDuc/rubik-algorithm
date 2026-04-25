import type { Move, State } from '../types'
import { applyPermutation } from './perm'
import { movePermutation } from './moves-3x3'

export const applyMove = (state: State, move: Move): State =>
  applyPermutation(state, movePermutation(move))
