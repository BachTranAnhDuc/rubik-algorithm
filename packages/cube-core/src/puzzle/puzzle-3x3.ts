import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { applyMove } from '../moves/apply'
import { invertMove } from '../moves/inverse'
import { formatAlgorithm, formatMove, parseAlgorithm } from '../moves/parser'
import { wcaScramble } from '../scramble/wca-3x3'
import {
  fromStickerString,
  hashState,
  isSolved,
  SOLVED_STATE,
  stateEquals,
  toStickerString,
} from '../state/sticker-model'
import type { Move, State } from '../types'

import type { Puzzle, ScrambleOptions } from './puzzle.interface'

export const Puzzle3x3: Puzzle<State, Move> = {
  id: '3x3',
  displayName: '3x3 Cube',
  solved: SOLVED_STATE,
  parseAlgorithm,
  formatAlgorithm,
  formatMove,
  applyMove,
  applyAlgorithm: (state, moves) => applyAlgorithm(state, moves),
  invertMove,
  invertAlgorithm: (moves) => invertAlgorithm(moves),
  isSolved,
  stateEquals,
  hashState,
  fromStickerString,
  toStickerString,
  scramble: (options?: ScrambleOptions) => wcaScramble(options),
}
