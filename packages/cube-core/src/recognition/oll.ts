import type { State } from '../types'
import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE } from '../state/sticker-model'

import type { AufCount, YRotationCount } from './normalize'
import { aufYVariants } from './normalize'

// Cases are numbered 1..57 per the standard OLL chart.
export type OllId = `OLL${number}`

// One canonical solving algorithm per OLL case. Sources: Speedsolving wiki and
// J Perm's reference set. Used to generate the canonical case state via
// `applyAlgorithm(SOLVED, invertAlgorithm(alg))`.
export const OLL_ALGORITHMS: Readonly<Record<string, string>> = {
  OLL1:  "R U2 R2 F R F' U2 R' F R F'",
  OLL2:  "F R U R' U' F' f R U R' U' f'",
  OLL3:  "f R U R' U' f' U' F R U R' U' F'",
  OLL4:  "f R U R' U' f' U F R U R' U' F'",
  OLL5:  "r' U2 R U R' U r",
  OLL6:  "r U2 R' U' R U' r'",
  OLL7:  "r U R' U R U2 r'",
  OLL8:  "r' U' R U' R' U2 r",
  OLL9:  "R U R' U' R' F R2 U R' U' F'",
  OLL10: "R U R' U R' F R F' R U2 R'",
  OLL11: "r U R' U R' F R F' R U2 r'",
  OLL12: "F R U R' U' F' U F R U R' U' F'",
  OLL13: "F U R U2 R' U' R U R' F'",
  OLL14: "R' F R U R' F' R F U' F'",
  OLL15: "r' U' r R' U' R U r' U r",
  OLL16: "r U r' R U R' U' r U' r'",
  OLL17: "R U R' U R' F R F' U2 R' F R F'",
  OLL18: "r U R' U R U2 r' r' U' R U' R' U2 r",
  OLL19: "M U R U R' U' M' R' F R F'",
  OLL20: "M U R U R' U' M2 U R U' r'",
  OLL21: "R U2 R' U' R U R' U' R U' R'",
  OLL22: "R U2 R2 U' R2 U' R2 U2 R",
  OLL23: "R2 D' R U2 R' D R U2 R",
  OLL24: "r U R' U' r' F R F'",
  OLL25: "F' r U R' U' r' F R",
  OLL26: "R U2 R' U' R U' R'",
  OLL27: "R U R' U R U2 R'",
  OLL28: "r U R' U' r' R U R U' R'",
  OLL29: "R U R' U' R U' R' F' U' F R U R'",
  OLL30: "F R' F R2 U' R' U' R U R' F2",
  OLL31: "R' U' F U R U' R' F' R",
  OLL32: "L U F' U' L' U L F L'",
  OLL33: "R U R' U' R' F R F'",
  OLL34: "R U R2 U' R' F R U R U' F'",
  OLL35: "R U2 R2 F R F' R U2 R'",
  OLL36: "L' U' L U' L' U L U L F' L' F",
  OLL37: "F R' F' R U R U' R'",
  OLL38: "R U R' U R U' R' U' R' F R F'",
  OLL39: "L F' L' U' L U F U' L'",
  OLL40: "R' F R U R' U' F' U R",
  OLL41: "R U R' U R U2 R' F R U R' U' F'",
  OLL42: "R' U' R U' R' U2 R F R U R' U' F'",
  OLL43: "f' L' U' L U f",
  OLL44: "f R U R' U' f'",
  OLL45: "F R U R' U' F'",
  OLL46: "R' U' R' F R F' U R",
  OLL47: "R' U' R' F R F' R' F R F' U R",
  OLL48: "F R U R' U' R U R' U' F'",
  OLL49: "r U' r2 U r2 U r2 U' r",
  OLL50: "r' U r2 U' r2 U' r2 U r'",
  OLL51: "f R U R' U' R U R' U' f'",
  OLL52: "R' F' U' F U' R U R' U R",
  OLL53: "r' U' R U' R' U R U' R' U2 r",
  OLL54: "r U R' U R U' R' U R U2 r'",
  OLL55: "R U2 R2 U' R U' R' U2 F R F'",
  OLL56: "r U r' U R U' R' U R U' R' r U' r'",
  OLL57: "R U R' U' M' U R U' r'",
}

export const OLL_IDS = Object.keys(OLL_ALGORITHMS) as readonly string[]

const buildCanonicalState = (alg: string): State =>
  applyAlgorithm(SOLVED_STATE, invertAlgorithm(alg))

export const OLL_CANONICAL_STATES: ReadonlyMap<State, string> = (() => {
  const map = new Map<State, string>()
  for (const id of OLL_IDS) {
    map.set(buildCanonicalState(OLL_ALGORITHMS[id]!), id)
  }
  return map
})()

export interface OllRecognition {
  readonly caseId: string
  readonly auf: AufCount
  readonly y: YRotationCount
}

export const recognizeOll = (state: State): OllRecognition | null => {
  for (const variant of aufYVariants(state)) {
    const id = OLL_CANONICAL_STATES.get(variant.state)
    if (id) return { caseId: id, auf: variant.auf, y: variant.y }
  }
  return null
}
