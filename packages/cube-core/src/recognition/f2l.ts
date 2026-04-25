import type { State } from '../types'
import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE } from '../state/sticker-model'

import type { AufCount } from './normalize'
import { aufVariants } from './normalize'

export type F2lId = `F2L${number}`

// F2L solving algorithms — corner-edge insertion into the FR slot. The full
// CFOP F2L chart enumerates 41 unique cases modulo AUF. This table currently
// ships 31 cases that have been verified pairwise-distinct under our AUF
// normalization. Remaining cases will be added when the content layer
// provides authoritative case data with one alg per case.
//
// Each alg, when applied to the standard "cross + 3 slots" cube state, solves
// the FR slot. We model the case state as `inverse(alg)` applied to SOLVED;
// recognition compares full state across the 4 AUF variants.
export const F2L_ALGORITHMS: Readonly<Record<string, string>> = {
  F2L1:  "U R U' R'",
  F2L2:  "y U' L' U L y'",
  F2L3:  "U' R U R'",
  F2L4:  "y U L' U' L y'",
  F2L5:  "U' R U2 R' U R U' R'",
  F2L6:  "U F' U2 F U' F' U F",
  F2L7:  "U R U2 R' U' R U R'",
  F2L8:  "U' F' U2 F U F' U' F",
  F2L9:  "U' R U' R' U2 R U' R'",
  F2L10: "U F' U F U2 F' U F",
  F2L11: "U' R U R' U R U R'",
  F2L12: "U F' U' F U' F' U' F",
  F2L13: "R U' R' U R U R' U R U' R'",
  F2L14: "F' U F U' F' U' F U' F' U F",
  F2L15: "R U' R' U' R U R' U' R U R'",
  F2L16: "F' U F U F' U' F U F' U' F",
  F2L17: "U R U2 R' U2 R U' R'",
  F2L18: "U' F' U2 F U2 F' U F",
  F2L21: "R U R' U' R U R' U' R U R'",
  F2L22: "U2 R U R' U R U' R'",
  F2L23: "U2 F' U' F U' F' U F",
  F2L24: "U R U' R' U2 R U R'",
  F2L25: "U' F' U F U2 F' U' F",
  F2L26: "U' R U' R' U R U R'",
  F2L27: "U F' U F U' F' U' F",
  F2L34: "U2 R U' R' U R U' R'",
  F2L35: "U2 F' U F U' F' U F",
  F2L36: "U' R U2 R' U' R U' R'",
  F2L37: "U F' U2 F U F' U F",
  F2L38: "R U R' U2 R U' R'",
  F2L39: "F' U' F U2 F' U F",
}

export const F2L_IDS = Object.keys(F2L_ALGORITHMS) as readonly string[]

const buildCanonicalState = (alg: string): State =>
  applyAlgorithm(SOLVED_STATE, invertAlgorithm(alg))

export const F2L_CANONICAL_STATES: ReadonlyMap<State, string> = (() => {
  const map = new Map<State, string>()
  for (const id of F2L_IDS) {
    const state = buildCanonicalState(F2L_ALGORITHMS[id]!)
    if (!map.has(state)) map.set(state, id)
  }
  return map
})()

export interface F2lRecognition {
  readonly caseId: string
  readonly auf: AufCount
}

// F2L only AUF-normalizes; the FR slot is fixed, so y-rotation would change
// which slot is "FR". For real-world recognition over arbitrary U-layer
// configurations, piece-based identification (locate the DFR corner + FR
// edge by sticker colors) is needed; this helper round-trips canonical case
// states only.
export const recognizeF2l = (state: State): F2lRecognition | null => {
  for (const variant of aufVariants(state)) {
    const id = F2L_CANONICAL_STATES.get(variant.state)
    if (id) return { caseId: id, auf: variant.auf }
  }
  return null
}
