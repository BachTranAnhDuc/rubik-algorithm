import { describe, expect, it } from 'vitest'

import { mulberry32 } from '../scramble/rng'

import { Puzzle3x3 } from './puzzle-3x3'

describe('Puzzle3x3', () => {
  it('exposes the expected identity', () => {
    expect(Puzzle3x3.id).toBe('3x3')
    expect(Puzzle3x3.displayName).toBe('3x3 Cube')
    expect(Puzzle3x3.solved).toBeTypeOf('string')
    expect(Puzzle3x3.isSolved(Puzzle3x3.solved)).toBe(true)
  })

  it('round-trips notation through the interface only', () => {
    const moves = Puzzle3x3.parseAlgorithm("R U R' U'")
    const formatted = Puzzle3x3.formatAlgorithm(moves)

    expect(formatted).toBe("R U R' U'")
    expect(moves).toHaveLength(4)
    expect(Puzzle3x3.formatMove(moves[0]!)).toBe('R')
  })

  it('applies sexy-move six times back to solved', () => {
    const sexy = Puzzle3x3.parseAlgorithm("R U R' U'")
    let state = Puzzle3x3.solved
    for (let i = 0; i < 6; i++) state = Puzzle3x3.applyAlgorithm(state, sexy)

    expect(Puzzle3x3.isSolved(state)).toBe(true)
    expect(Puzzle3x3.stateEquals(state, Puzzle3x3.solved)).toBe(true)
  })

  it('inverts an algorithm to undo a state change', () => {
    const moves = Puzzle3x3.parseAlgorithm("R U R' U R U2 R'")
    const scrambled = Puzzle3x3.applyAlgorithm(Puzzle3x3.solved, moves)
    const restored = Puzzle3x3.applyAlgorithm(
      scrambled,
      Puzzle3x3.invertAlgorithm(moves),
    )

    expect(Puzzle3x3.stateEquals(restored, Puzzle3x3.solved)).toBe(true)
  })

  it('inverts a single move', () => {
    const r = Puzzle3x3.parseAlgorithm('R')[0]!
    const rPrime = Puzzle3x3.invertMove(r)

    expect(rPrime.axis).toBe('R')
    expect(rPrime.amount).toBe(3)
  })

  it('round-trips through the sticker representation', () => {
    const scrambled = Puzzle3x3.applyAlgorithm(
      Puzzle3x3.solved,
      Puzzle3x3.parseAlgorithm("R U R' F' R U R' U' R' F R2 U' R'"),
    )
    const str = Puzzle3x3.toStickerString(scrambled)
    const reparsed = Puzzle3x3.fromStickerString(str)

    expect(Puzzle3x3.stateEquals(reparsed, scrambled)).toBe(true)
    expect(Puzzle3x3.hashState(scrambled)).toBe(Puzzle3x3.hashState(reparsed))
  })

  it('produces a deterministic scramble of the requested length', () => {
    const a = Puzzle3x3.scramble({ length: 25, rng: mulberry32(42) })
    const b = Puzzle3x3.scramble({ length: 25, rng: mulberry32(42) })

    expect(a).toHaveLength(25)
    expect(Puzzle3x3.formatAlgorithm(a)).toBe(Puzzle3x3.formatAlgorithm(b))
  })
})
