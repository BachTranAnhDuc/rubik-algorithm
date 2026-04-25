export type Random = () => number

// Mulberry32: a tiny, fast, well-distributed 32-bit PRNG. Suitable for tests
// and content generation; not cryptographically secure.
export const mulberry32 = (seed: number): Random => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const defaultRandom: Random = () => Math.random()

export const randomInt = (rng: Random, max: number): number => {
  if (max <= 0) throw new Error(`max must be positive, got ${max}`)
  return Math.floor(rng() * max)
}

export const randomChoice = <T>(rng: Random, items: readonly T[]): T => {
  if (items.length === 0) throw new Error('cannot choose from empty array')
  return items[randomInt(rng, items.length)]!
}
