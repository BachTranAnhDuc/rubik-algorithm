import { describe, expect, it } from 'vitest'

import type { ContentBundle, LoadedCase } from '../load-content'
import { validateContent } from '../validate-content'

const validPuzzle = (data: Record<string, unknown> = {}) => ({
  filePath: '/tmp/puzzle.yaml',
  data: {
    slug: '3x3',
    name: '3x3',
    display_name: '3x3 Cube',
    wca_event_code: '333',
    display_order: 0,
    state_schema_version: 'v1',
    ...data,
  },
})

const validMethod = (data: Record<string, unknown> = {}) => ({
  filePath: '/tmp/method.yaml',
  puzzleSlug: '3x3',
  data: { slug: 'cfop', name: 'CFOP', display_order: 0, description_md: null, ...data },
})

const validSet = (data: Record<string, unknown> = {}) => ({
  filePath: '/tmp/set.yaml',
  puzzleSlug: '3x3',
  methodSlug: 'cfop',
  data: {
    slug: 'pll',
    name: 'PLL',
    display_name: 'Permutation of the Last Layer',
    case_count_expected: 21,
    recognition_basis: 'PLL_PERMUTATION',
    display_order: 2,
    description_md: null,
    ...data,
  },
})

const TPERM_STATE = 'UUUUUUUUUFFRFFFFFFBLFRRRRRRDDDDDDDDDLRLLLLLLLRBBBBBBBB'
const TPERM_ALG = "R U R' U' R' F R2 U' R' U' R U R' F'"

const validCase = (overrides: Record<string, unknown> = {}): LoadedCase => ({
  filePath: '/tmp/t-perm.yaml',
  puzzleSlug: '3x3',
  methodSlug: 'cfop',
  setSlug: 'pll',
  data: {
    slug: 't-perm',
    name: 'T-Perm',
    display_name: 'T-Perm',
    display_order: 0,
    case_state: TPERM_STATE,
    recognition_md: null,
    tags: ['pll'],
    variants: [
      {
        notation: TPERM_ALG,
        is_primary: true,
        attribution: null,
        fingertrick_md: null,
        video_url: null,
      },
    ],
    ...overrides,
  },
})

const buildBundle = (parts: Partial<ContentBundle> = {}): ContentBundle => ({
  puzzles: parts.puzzles ?? [validPuzzle()],
  methods: parts.methods ?? [validMethod()],
  sets: parts.sets ?? [validSet()],
  cases: parts.cases ?? [validCase()],
})

describe('validateContent', () => {
  it('accepts a well-formed bundle including the canonical T-Perm case', () => {
    expect(() => validateContent(buildBundle())).not.toThrow()
  })

  it('rejects a case whose case_state is not 54 chars', () => {
    const bad = validCase({ case_state: 'UUU' })
    expect(() => validateContent(buildBundle({ cases: [bad] }))).toThrow(/case_state/)
  })

  it('rejects a case with two is_primary variants', () => {
    const bad = validCase({
      variants: [
        { notation: TPERM_ALG, is_primary: true, attribution: null, fingertrick_md: null, video_url: null },
        { notation: "R U R'", is_primary: true, attribution: null, fingertrick_md: null, video_url: null },
      ],
    })
    expect(() => validateContent(buildBundle({ cases: [bad] }))).toThrow(/is_primary/)
  })

  it('rejects a case whose primary notation does not solve case_state', () => {
    const bad = validCase({
      variants: [
        { notation: "R U R'", is_primary: true, attribution: null, fingertrick_md: null, video_url: null },
      ],
    })
    expect(() => validateContent(buildBundle({ cases: [bad] }))).toThrow(/does not solve case_state/)
  })

  it('rejects a slug that is not kebab-case', () => {
    const bad = { ...validPuzzle(), data: { ...validPuzzle().data, slug: 'NotKebab' } }
    expect(() => validateContent(buildBundle({ puzzles: [bad] }))).toThrow(/slug/i)
  })
})
