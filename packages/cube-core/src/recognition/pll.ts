import type { State } from '../types'
import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE } from '../state/sticker-model'

import type { AufCount, YRotationCount } from './normalize'
import { aufYVariants } from './normalize'

export type PllId =
  | 'Aa' | 'Ab' | 'E' | 'F'
  | 'Ga' | 'Gb' | 'Gc' | 'Gd'
  | 'H' | 'Ja' | 'Jb' | 'Na' | 'Nb'
  | 'Ra' | 'Rb' | 'T' | 'Ua' | 'Ub'
  | 'V' | 'Y' | 'Z'

// One canonical solving algorithm per PLL case. Source: standard speedcubing
// references. Used to generate the canonical case state via
// `applyAlgorithm(SOLVED, invertAlgorithm(alg))`.
export const PLL_ALGORITHMS: Readonly<Record<PllId, string>> = {
  Aa: "x R' U R' D2 R U' R' D2 R2 x'",
  Ab: "x R2 D2 R U R' D2 R U' R x'",
  E:  "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
  F:  "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
  Ga: "R2 U R' U R' U' R U' R2 D U' R' U R D'",
  Gb: "R' U' R U D' R2 U R' U R U' R U' R2 D",
  Gc: "R2 U' R U' R U R' U R2 D' U R U' R' D",
  Gd: "R U R' U' D R2 U' R U' R' U R' U R2 D'",
  H:  "M2 U M2 U2 M2 U M2",
  Ja: "x R2 F R F' R U2 r' U r U2 x'",
  Jb: "R U R' F' R U R' U' R' F R2 U' R'",
  Na: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  Nb: "R' U R U' R' F' U' F R U R' F R' F' R U' R",
  Ra: "R U' R' U' R U R D R' U' R D' R' U2 R'",
  Rb: "R' U2 R U2 R' F R U R' U' R' F' R2",
  T:  "R U R' U' R' F R2 U' R' U' R U R' F'",
  Ua: "R U' R U R U R U' R' U' R2",
  Ub: "R2 U R U R' U' R' U' R' U R'",
  V:  "R' U R' U' y R' F' R2 U' R' U R' F R F",
  Y:  "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  Z:  "M2 U M2 U M' U2 M2 U2 M' U2",
}

export const PLL_IDS = Object.keys(PLL_ALGORITHMS) as readonly PllId[]

const buildCanonicalState = (alg: string): State =>
  applyAlgorithm(SOLVED_STATE, invertAlgorithm(alg))

// Map from canonical case state → PLL id. State is the unique 54-char string
// reached by applying inverse(alg) to solved.
export const PLL_CANONICAL_STATES: ReadonlyMap<State, PllId> = (() => {
  const map = new Map<State, PllId>()
  for (const id of PLL_IDS) {
    map.set(buildCanonicalState(PLL_ALGORITHMS[id]), id)
  }
  return map
})()

export interface PllRecognition {
  readonly caseId: PllId
  readonly auf: AufCount
  readonly y: YRotationCount
}

// Tries the 16 (AUF × y-rotation) variants of `state` and returns the first
// one that matches a canonical PLL state. Returns null if none match.
export const recognizePll = (state: State): PllRecognition | null => {
  for (const variant of aufYVariants(state)) {
    const id = PLL_CANONICAL_STATES.get(variant.state)
    if (id) return { caseId: id, auf: variant.auf, y: variant.y }
  }
  return null
}
