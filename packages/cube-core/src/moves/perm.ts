import { STICKER_COUNT } from '../state/sticker-model'

export type Permutation = readonly number[]

// A single n-cycle [a,b,c,d] means a→b→c→d→a: position b receives what was
// at position a, c receives what was at b, etc. Disjoint cycles compose.
export type Cycle = readonly number[]

export const identityPermutation = (size = STICKER_COUNT): Permutation =>
  Array.from({ length: size }, (_, i) => i)

// Build a permutation array from disjoint cycles. Untouched positions stay fixed.
export const cyclesToPermutation = (cycles: readonly Cycle[], size = STICKER_COUNT): Permutation => {
  const perm = Array.from({ length: size }, (_, i) => i)
  for (const cycle of cycles) {
    if (cycle.length < 2) continue
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i]!
      const to = cycle[(i + 1) % cycle.length]!
      // a→b means: position b receives what was at position a.
      perm[to] = from
    }
  }
  return perm
}

// Compose two permutations. Reading order: apply `first`, then `second`.
// (second ∘ first)[i] = first[second[i]]   (new[i] = old applied via the chain).
//
// applyPerm(state, p)[i] = state[p[i]].
// applyPerm(applyPerm(state, first), second)[i]
//   = applyPerm(state, first)[second[i]] = state[first[second[i]]].
// So the combined perm has p_combined[i] = first[second[i]].
export const composePermutations = (first: Permutation, second: Permutation): Permutation => {
  if (first.length !== second.length) {
    throw new Error(`permutation length mismatch: ${first.length} vs ${second.length}`)
  }
  const out = new Array<number>(first.length)
  for (let i = 0; i < first.length; i++) {
    out[i] = first[second[i]!]!
  }
  return out
}

// Invert a permutation. inverse[p[i]] = i.
export const invertPermutation = (perm: Permutation): Permutation => {
  const out = new Array<number>(perm.length)
  for (let i = 0; i < perm.length; i++) {
    out[perm[i]!] = i
  }
  return out
}

// Apply a permutation to a state: new[i] = state[perm[i]].
export const applyPermutation = (state: string, perm: Permutation): string => {
  if (state.length !== perm.length) {
    throw new Error(`state length ${state.length} does not match perm length ${perm.length}`)
  }
  const chars = new Array<string>(perm.length)
  for (let i = 0; i < perm.length; i++) {
    chars[i] = state[perm[i]!]!
  }
  return chars.join('')
}

// Power: apply a permutation `n` times (n >= 0).
export const powerPermutation = (perm: Permutation, n: number): Permutation => {
  if (n < 0) throw new Error(`n must be non-negative, got ${n}`)
  if (n === 0) return identityPermutation(perm.length)
  let out: Permutation = perm
  for (let i = 1; i < n; i++) out = composePermutations(perm, out)
  return out
}
