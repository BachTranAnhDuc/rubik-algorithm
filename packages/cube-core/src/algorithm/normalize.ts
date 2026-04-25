import type { Algorithm } from '../types'
import { cancelMoves } from '../moves/cancel'
import { parseAlgorithm } from '../moves/parser'

// Behavior-preserving canonicalization. Today: cancel-to-fixpoint.
// Single-pass cancelMoves already cascades, so one pass is the fixpoint.
export const normalize = (alg: Algorithm | string): Algorithm => {
  const moves = typeof alg === 'string' ? parseAlgorithm(alg) : alg
  return cancelMoves(moves)
}
