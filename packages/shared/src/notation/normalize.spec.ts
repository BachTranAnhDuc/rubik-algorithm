import { describe, expect, it } from 'vitest'

import { formatNotation } from './format'
import { normalizeNotation } from './normalize'

describe('normalizeNotation', () => {
  it('trims and single-spaces', () => {
    expect(normalizeNotation("  R  U   R'  U'  ")).toBe("R U R' U'")
  })

  it('preserves case (face moves are case-sensitive)', () => {
    expect(normalizeNotation('R Rw r')).toBe('R Rw r')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeNotation('')).toBe('')
    expect(normalizeNotation('   ')).toBe('')
  })

  it('is idempotent', () => {
    const once = normalizeNotation("R U R' U'")
    expect(normalizeNotation(once)).toBe(once)
  })
})

describe('formatNotation', () => {
  it('matches normalizeNotation in v1', () => {
    expect(formatNotation("  R   U   R' ")).toBe(normalizeNotation("  R   U   R' "))
  })
})
