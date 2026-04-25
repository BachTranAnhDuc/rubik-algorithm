import { describe, expect, it } from 'vitest'

import {
  FACE_OFFSET,
  SOLVED_STATE,
  STICKER_COUNT,
  fromStickerString,
  hashState,
  isSolved,
  stateEquals,
  stickerIndex,
  toStickerString,
} from './sticker-model'

describe('SOLVED_STATE', () => {
  it('has 54 stickers, 9 of each face in UFRDLB order', () => {
    expect(SOLVED_STATE.length).toBe(STICKER_COUNT)
    expect(SOLVED_STATE.slice(0, 9)).toBe('UUUUUUUUU')
    expect(SOLVED_STATE.slice(9, 18)).toBe('FFFFFFFFF')
    expect(SOLVED_STATE.slice(18, 27)).toBe('RRRRRRRRR')
    expect(SOLVED_STATE.slice(27, 36)).toBe('DDDDDDDDD')
    expect(SOLVED_STATE.slice(36, 45)).toBe('LLLLLLLLL')
    expect(SOLVED_STATE.slice(45, 54)).toBe('BBBBBBBBB')
  })
})

describe('isSolved', () => {
  it('true for solved state', () => {
    expect(isSolved(SOLVED_STATE)).toBe(true)
  })

  it('false for any non-solved state', () => {
    const scrambled = SOLVED_STATE.split('').reverse().join('')
    expect(isSolved(scrambled)).toBe(false)
  })
})

describe('fromStickerString / toStickerString', () => {
  it('roundtrips with whitespace tolerance', () => {
    const padded = SOLVED_STATE.match(/.{1,3}/g)!.join(' ')
    const parsed = fromStickerString(padded)
    expect(parsed).toBe(SOLVED_STATE)
    expect(toStickerString(parsed)).toBe(SOLVED_STATE)
  })

  it('rejects wrong-length input', () => {
    expect(() => fromStickerString('short')).toThrow(/54 characters/)
    expect(() => fromStickerString('U'.repeat(55))).toThrow(/54 characters/)
  })
})

describe('stateEquals + hashState', () => {
  it('two equal states match', () => {
    expect(stateEquals(SOLVED_STATE, SOLVED_STATE)).toBe(true)
    expect(hashState(SOLVED_STATE)).toBe(hashState(SOLVED_STATE))
  })

  it('different states differ', () => {
    const other = SOLVED_STATE.split('').reverse().join('')
    expect(stateEquals(SOLVED_STATE, other)).toBe(false)
    expect(hashState(SOLVED_STATE)).not.toBe(hashState(other))
  })
})

describe('stickerIndex', () => {
  it('maps face + within-face to global index', () => {
    expect(stickerIndex('U', 0)).toBe(FACE_OFFSET.U)
    expect(stickerIndex('R', 4)).toBe(FACE_OFFSET.R + 4)
    expect(stickerIndex('B', 8)).toBe(FACE_OFFSET.B + 8)
  })

  it('throws on out-of-range within-face', () => {
    expect(() => stickerIndex('U', -1)).toThrow(/out of range/)
    expect(() => stickerIndex('U', 9)).toThrow(/out of range/)
  })
})
