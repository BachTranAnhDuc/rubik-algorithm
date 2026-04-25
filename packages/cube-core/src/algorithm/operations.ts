import type { Algorithm, Move, State } from '../types'
import { applyMove } from '../moves/apply'
import { invertMove } from '../moves/inverse'
import { parseAlgorithm } from '../moves/parser'

export const applyAlgorithm = (state: State, alg: Algorithm | string): State => {
  const moves: Algorithm = typeof alg === 'string' ? parseAlgorithm(alg) : alg
  let s = state
  for (const move of moves) s = applyMove(s, move)
  return s
}

// Inverse of an algorithm: reverse order, invert each move.
export const invertAlgorithm = (alg: Algorithm | string): Algorithm => {
  const moves: Algorithm = typeof alg === 'string' ? parseAlgorithm(alg) : alg
  const out: Move[] = []
  for (let i = moves.length - 1; i >= 0; i--) out.push(invertMove(moves[i]!))
  return out
}

// Conjugate: A B A'  (do A, do B, undo A).
export const conjugate = (
  setup: Algorithm | string,
  inner: Algorithm | string,
): Algorithm => {
  const a = typeof setup === 'string' ? parseAlgorithm(setup) : [...setup]
  const b = typeof inner === 'string' ? parseAlgorithm(inner) : [...inner]
  return [...a, ...b, ...invertAlgorithm(a)]
}

// Commutator: [A, B] = A B A' B'.
export const commutator = (a: Algorithm | string, b: Algorithm | string): Algorithm => {
  const aa = typeof a === 'string' ? parseAlgorithm(a) : [...a]
  const bb = typeof b === 'string' ? parseAlgorithm(b) : [...b]
  return [...aa, ...bb, ...invertAlgorithm(aa), ...invertAlgorithm(bb)]
}

// Concatenation helper.
export const concat = (...algs: ReadonlyArray<Algorithm | string>): Algorithm => {
  const out: Move[] = []
  for (const alg of algs) {
    const moves = typeof alg === 'string' ? parseAlgorithm(alg) : alg
    out.push(...moves)
  }
  return out
}
