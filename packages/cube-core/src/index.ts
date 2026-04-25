// Public API surface — see §20.1 of the design doc.

// Types
export type { Move, MoveAxis, MoveAmount, Algorithm, State, Face } from './types'

// State
export {
  SOLVED_STATE,
  isSolved,
  fromStickerString,
  toStickerString,
  stateEquals,
  hashState,
  stickerIndex,
  FACE_ORDER,
  FACE_OFFSET,
  STICKER_COUNT,
} from './state/sticker-model'

// Moves
export { parseAlgorithm, formatMove, formatAlgorithm } from './moves/parser'
export { applyMove } from './moves/apply'
export { invertMove } from './moves/inverse'
export { movePermutation, baseTurns } from './moves/moves-3x3'

// Algorithm operations
export {
  applyAlgorithm,
  invertAlgorithm,
  conjugate,
  commutator,
  concat,
} from './algorithm/operations'

// Metrics
export { htm, stm, etm, qtm } from './algorithm/metrics'
