import { describe, expect, it } from 'vitest'

import { isSlug, SlugSchema, toSlug } from './slug'

describe('SlugSchema', () => {
  it('accepts kebab-case lowercase alphanumeric', () => {
    expect(SlugSchema.safeParse('t-perm').success).toBe(true)
    expect(SlugSchema.safeParse('aa-perm').success).toBe(true)
    expect(SlugSchema.safeParse('3x3').success).toBe(true)
    expect(SlugSchema.safeParse('cfop').success).toBe(true)
  })

  it('rejects uppercase, spaces, leading/trailing/consecutive hyphens', () => {
    expect(SlugSchema.safeParse('T-Perm').success).toBe(false)
    expect(SlugSchema.safeParse('t perm').success).toBe(false)
    expect(SlugSchema.safeParse('-t-perm').success).toBe(false)
    expect(SlugSchema.safeParse('t-perm-').success).toBe(false)
    expect(SlugSchema.safeParse('t--perm').success).toBe(false)
    expect(SlugSchema.safeParse('').success).toBe(false)
  })
})

describe('isSlug', () => {
  it('matches the schema', () => {
    expect(isSlug('t-perm')).toBe(true)
    expect(isSlug('T-Perm')).toBe(false)
  })
})

describe('toSlug', () => {
  it('converts arbitrary strings to a valid slug', () => {
    expect(toSlug('T Perm')).toBe('t-perm')
    expect(toSlug('  Hello World!  ')).toBe('hello-world')
    expect(toSlug('Already-Kebab')).toBe('already-kebab')
  })

  it('output passes the schema', () => {
    expect(SlugSchema.safeParse(toSlug('T Perm')).success).toBe(true)
    expect(SlugSchema.safeParse(toSlug('Hello World!')).success).toBe(true)
  })
})
