import type { Algorithm, State } from '../types'
import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE } from '../state/sticker-model'

// A "case scramble" produces the state that a given solving algorithm solves.
// Two equivalent forms: the inverse of the solving alg, or applying that
// inverse to the solved cube to get the resulting state.

// Returns the move sequence that, applied to a solved cube, leaves it in the
// case state targeted by `solvingAlg`.
export const scrambleIntoCase = (solvingAlg: Algorithm | string): Algorithm =>
  invertAlgorithm(solvingAlg)

// Returns the state for the case targeted by `solvingAlg`, computed from
// SOLVED_STATE.
export const stateForCase = (solvingAlg: Algorithm | string): State =>
  applyAlgorithm(SOLVED_STATE, invertAlgorithm(solvingAlg))
