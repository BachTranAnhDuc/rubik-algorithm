import { describe, expect, it } from 'vitest'

import { isMoveToken, MOVE_TOKEN_REGEX, tokenizeNotation } from './tokens'

describe('MOVE_TOKEN_REGEX', () => {
  it('accepts face turns with all suffixes', () => {
    for (const face of ['U', 'D', 'F', 'B', 'R', 'L']) {
      expect(MOVE_TOKEN_REGEX.test(face)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${face}'`)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${face}2`)).toBe(true)
    }
  })

  it('accepts wide turns', () => {
    for (const face of ['Uw', 'Dw', 'Fw', 'Bw', 'Rw', 'Lw']) {
      expect(MOVE_TOKEN_REGEX.test(face)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${face}'`)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${face}2`)).toBe(true)
    }
  })

  it('accepts lowercase wide shorthand (u/d/f/b/r/l)', () => {
    for (const face of ['u', 'd', 'f', 'b', 'r', 'l']) {
      expect(MOVE_TOKEN_REGEX.test(face)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${face}'`)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${face}2`)).toBe(true)
    }
  })

  it('accepts slices and rotations', () => {
    for (const t of ['M', 'E', 'S', 'x', 'y', 'z']) {
      expect(MOVE_TOKEN_REGEX.test(t)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${t}'`)).toBe(true)
      expect(MOVE_TOKEN_REGEX.test(`${t}2`)).toBe(true)
    }
  })

  it('rejects garbage tokens', () => {
    expect(MOVE_TOKEN_REGEX.test('R3')).toBe(false)
    expect(MOVE_TOKEN_REGEX.test("R''")).toBe(false)
    expect(MOVE_TOKEN_REGEX.test('')).toBe(false)
    expect(MOVE_TOKEN_REGEX.test('Q')).toBe(false)
    expect(MOVE_TOKEN_REGEX.test('m')).toBe(false) // lowercase slices not allowed
    expect(MOVE_TOKEN_REGEX.test('X')).toBe(false) // uppercase rotations not allowed
  })
})

describe('isMoveToken', () => {
  it('matches the regex', () => {
    expect(isMoveToken("R'")).toBe(true)
    expect(isMoveToken('R3')).toBe(false)
  })
})

describe('tokenizeNotation', () => {
  it('splits on whitespace and trims', () => {
    expect(tokenizeNotation("R U R' U'")).toEqual(['R', 'U', "R'", "U'"])
  })

  it('collapses repeated whitespace', () => {
    expect(tokenizeNotation("R   U  R'")).toEqual(['R', 'U', "R'"])
  })

  it('handles empty/whitespace-only input', () => {
    expect(tokenizeNotation('')).toEqual([])
    expect(tokenizeNotation('   ')).toEqual([])
  })
})
