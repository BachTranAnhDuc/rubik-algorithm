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
export { mirrorMove, mirrorAlgorithm, type MirrorPlane } from './moves/mirror'
export { cancelMoves } from './moves/cancel'

// Algorithm operations
export {
  applyAlgorithm,
  invertAlgorithm,
  conjugate,
  commutator,
  concat,
} from './algorithm/operations'
export { normalize } from './algorithm/normalize'

// Metrics
export { htm, stm, etm, qtm } from './algorithm/metrics'

// Recognition
export {
  AUF_ALGS,
  Y_ALGS,
  aufVariants,
  aufYVariants,
  type AufCount,
  type StateVariant,
  type YRotationCount,
} from './recognition/normalize'
export {
  PLL_ALGORITHMS,
  PLL_CANONICAL_STATES,
  PLL_IDS,
  recognizePll,
  type PllId,
  type PllRecognition,
} from './recognition/pll'
export {
  OLL_ALGORITHMS,
  OLL_CANONICAL_STATES,
  OLL_IDS,
  recognizeOll,
  type OllId,
  type OllRecognition,
} from './recognition/oll'
export {
  F2L_ALGORITHMS,
  F2L_CANONICAL_STATES,
  F2L_IDS,
  recognizeF2l,
  type F2lId,
  type F2lRecognition,
} from './recognition/f2l'

// Scramble
export {
  defaultRandom,
  mulberry32,
  randomChoice,
  randomInt,
  type Random,
} from './scramble/rng'
export { wcaScramble, type WcaScrambleOptions } from './scramble/wca-3x3'
export { scrambleIntoCase, stateForCase } from './scramble/case-scramble'
