import type { Random } from '../scramble/rng'

export interface ScrambleOptions {
  readonly length?: number
  readonly seed?: number
  readonly rng?: Random
}

export interface Puzzle<TState, TMove> {
  readonly id: string
  readonly displayName: string
  readonly solved: TState

  parseAlgorithm: (input: string) => readonly TMove[]
  formatAlgorithm: (moves: readonly TMove[]) => string
  formatMove: (move: TMove) => string

  applyMove: (state: TState, move: TMove) => TState
  applyAlgorithm: (state: TState, moves: readonly TMove[]) => TState

  invertMove: (move: TMove) => TMove
  invertAlgorithm: (moves: readonly TMove[]) => readonly TMove[]

  isSolved: (state: TState) => boolean
  stateEquals: (a: TState, b: TState) => boolean
  hashState: (state: TState) => string

  fromStickerString: (str: string) => TState
  toStickerString: (state: TState) => string

  scramble: (options?: ScrambleOptions) => readonly TMove[]
}
