import { describe, expect, it } from 'vitest'

import {
  AlgorithmCaseSchema,
  AlgorithmSetSchema,
  AlgorithmVariantSchema,
  PuzzleSchema,
  RecognitionBasisSchema,
} from './puzzle'

describe('RecognitionBasisSchema', () => {
  it('accepts the documented enum values', () => {
    expect(RecognitionBasisSchema.safeParse('PLL_PERMUTATION').success).toBe(true)
    expect(RecognitionBasisSchema.safeParse('OLL_ORIENTATION').success).toBe(true)
  })

  it('rejects lowercase or unknown', () => {
    expect(RecognitionBasisSchema.safeParse('pll_permutation').success).toBe(false)
    expect(RecognitionBasisSchema.safeParse('FREESTYLE').success).toBe(false)
  })
})

describe('PuzzleSchema', () => {
  it('parses a valid puzzle row', () => {
    const result = PuzzleSchema.safeParse({
      id: 'p_3x3',
      slug: '3x3',
      name: '3x3 Cube',
      wcaEventCode: '333',
      displayOrder: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative displayOrder', () => {
    const result = PuzzleSchema.safeParse({
      id: 'p_3x3',
      slug: '3x3',
      name: '3x3 Cube',
      wcaEventCode: null,
      displayOrder: -1,
    })
    expect(result.success).toBe(false)
  })

  it('requires kebab-case slug', () => {
    const result = PuzzleSchema.safeParse({
      id: 'p_3x3',
      slug: 'NotASlug',
      name: '3x3 Cube',
      wcaEventCode: null,
      displayOrder: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('AlgorithmSetSchema', () => {
  it('accepts a typical PLL set row', () => {
    const result = AlgorithmSetSchema.safeParse({
      id: 's_pll',
      methodId: 'm_cfop',
      slug: 'pll',
      name: 'PLL',
      caseCountExpected: 21,
      recognitionBasis: 'PLL_PERMUTATION',
      displayOrder: 3,
    })
    expect(result.success).toBe(true)
  })
})

describe('AlgorithmCaseSchema', () => {
  it('accepts a case row', () => {
    const result = AlgorithmCaseSchema.safeParse({
      id: 'c_t_perm',
      setId: 's_pll',
      slug: 't-perm',
      name: 'T Perm',
      displayName: 'T-Perm',
      displayOrder: 14,
      caseState: 'x'.repeat(54),
      recognitionMd: null,
      tags: ['adjacent-corner-swap', 'edge-2-cycle'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-kebab-case tags', () => {
    const result = AlgorithmCaseSchema.safeParse({
      id: 'c_t_perm',
      setId: 's_pll',
      slug: 't-perm',
      name: 'T Perm',
      displayName: 'T-Perm',
      displayOrder: 14,
      caseState: 'x'.repeat(54),
      recognitionMd: null,
      tags: ['Adjacent Corner Swap'],
    })
    expect(result.success).toBe(false)
  })
})

describe('AlgorithmVariantSchema', () => {
  it('accepts a variant row with all optional metadata', () => {
    const result = AlgorithmVariantSchema.safeParse({
      id: 'v_t_perm_primary',
      caseId: 'c_t_perm',
      notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
      moveCountHtm: 14,
      moveCountStm: 14,
      isPrimary: true,
      attribution: 'Standard',
      fingertrickMd: null,
      displayOrder: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a minimal variant', () => {
    const result = AlgorithmVariantSchema.safeParse({
      id: 'v_x',
      caseId: 'c_x',
      notation: 'R',
      moveCountHtm: 1,
      moveCountStm: 1,
      isPrimary: false,
      attribution: null,
      fingertrickMd: null,
      displayOrder: 1,
    })
    expect(result.success).toBe(true)
  })

})
