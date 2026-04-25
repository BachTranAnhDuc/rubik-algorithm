import { describe, expect, it } from 'vitest'

import { CaseContentSchema, PuzzleContentSchema, SetContentSchema } from './content'

describe('PuzzleContentSchema', () => {
  it('accepts a 3x3 file', () => {
    const result = PuzzleContentSchema.safeParse({
      slug: '3x3',
      name: '3x3 Cube',
      display_name: '3×3',
      wca_event_code: '333',
      display_order: 0,
    })
    expect(result.success).toBe(true)
  })

  it('defaults state_schema_version to v1', () => {
    const result = PuzzleContentSchema.parse({
      slug: '3x3',
      name: '3x3 Cube',
      display_name: '3×3',
      display_order: 0,
    })
    expect(result.state_schema_version).toBe('v1')
  })
})

describe('SetContentSchema', () => {
  it('accepts a PLL set file', () => {
    const result = SetContentSchema.safeParse({
      slug: 'pll',
      name: 'PLL',
      case_count_expected: 21,
      recognition_basis: 'PLL_PERMUTATION',
      display_order: 3,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown recognition_basis', () => {
    const result = SetContentSchema.safeParse({
      slug: 'pll',
      name: 'PLL',
      case_count_expected: 21,
      recognition_basis: 'WHATEVER',
      display_order: 3,
    })
    expect(result.success).toBe(false)
  })
})

describe('CaseContentSchema', () => {
  const validBase = {
    slug: 't-perm',
    name: 'T Perm',
    display_name: 'T-Perm',
    display_order: 14,
    case_state: 'U'.repeat(54),
    recognition_md: null,
    tags: ['adjacent-corner-swap'],
  }

  it('accepts a case with exactly one primary variant', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      variants: [
        { notation: "R U R'", is_primary: true },
        { notation: "x R2 D2", is_primary: false },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a case with zero primary variants', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      variants: [
        { notation: "R U R'", is_primary: false },
        { notation: "x R2 D2", is_primary: false },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a case with two primary variants', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      variants: [
        { notation: "R U R'", is_primary: true },
        { notation: "x R2 D2", is_primary: true },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects case_state of wrong length (whitespace ignored)', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      case_state: 'U'.repeat(53),
      variants: [{ notation: "R U R'", is_primary: true }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts case_state with whitespace that normalizes to 54', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      case_state: 'UUUUUUUUU '.repeat(6).trim(),
      variants: [{ notation: "R U R'", is_primary: true }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty variants array', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      variants: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-kebab-case tags', () => {
    const result = CaseContentSchema.safeParse({
      ...validBase,
      tags: ['Adjacent Corner Swap'],
      variants: [{ notation: "R U R'", is_primary: true }],
    })
    expect(result.success).toBe(false)
  })
})
