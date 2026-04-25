import type { State } from '../types'
import { applyAlgorithm } from '../algorithm/operations'

export type AufCount = 0 | 1 | 2 | 3
export type YRotationCount = 0 | 1 | 2 | 3

export const AUF_ALGS: Readonly<Record<AufCount, string>> = {
  0: '',
  1: 'U',
  2: 'U2',
  3: "U'",
}

export const Y_ALGS: Readonly<Record<YRotationCount, string>> = {
  0: '',
  1: 'y',
  2: 'y2',
  3: "y'",
}

export interface StateVariant {
  readonly state: State
  readonly auf: AufCount
  readonly y: YRotationCount
}

const AUF_ORDER: readonly AufCount[] = [0, 1, 2, 3]
const Y_ORDER: readonly YRotationCount[] = [0, 1, 2, 3]

// Generates the 16 (AUF × y-rotation) variants of a state. AUF is applied
// before y-rotation: variant.state = y_alg ∘ auf_alg ∘ input.
export const aufYVariants = (state: State): readonly StateVariant[] => {
  const variants: StateVariant[] = []
  for (const auf of AUF_ORDER) {
    const aufed = auf === 0 ? state : applyAlgorithm(state, AUF_ALGS[auf])
    for (const y of Y_ORDER) {
      const final = y === 0 ? aufed : applyAlgorithm(aufed, Y_ALGS[y])
      variants.push({ state: final, auf, y })
    }
  }
  return variants
}

// AUF-only variants (4) — used by F2L which only AUF-normalizes.
export const aufVariants = (state: State): readonly StateVariant[] => {
  const variants: StateVariant[] = []
  for (const auf of AUF_ORDER) {
    const aufed = auf === 0 ? state : applyAlgorithm(state, AUF_ALGS[auf])
    variants.push({ state: aufed, auf, y: 0 })
  }
  return variants
}
