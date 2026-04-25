import { describe, expect, it } from 'vitest'

import { SOLVED_STATE } from '../state/sticker-model'
import { applyAlgorithm } from './operations'
import { normalize } from './normalize'
import { formatAlgorithm, parseAlgorithm } from '../moves/parser'

describe('normalize', () => {
  it('cancels redundant pairs', () => {
    expect(normalize("R R' U")).toEqual(parseAlgorithm('U'))
  })

  it('is idempotent', () => {
    const alg = "R U R' U' R U U' R'"
    const once = normalize(alg)
    const twice = normalize(once)
    expect(twice).toEqual(once)
  })

  it("preserves behavior on solved", () => {
    const alg = "R U2 U2 R' U U' F"
    const original = applyAlgorithm(SOLVED_STATE, alg)
    const normalized = applyAlgorithm(SOLVED_STATE, normalize(alg))
    expect(normalized).toBe(original)
  })

  it('accepts parsed input', () => {
    const parsed = parseAlgorithm("R R'")
    expect(normalize(parsed)).toEqual([])
  })

  it('formats trivially-empty input as empty', () => {
    expect(formatAlgorithm(normalize(''))).toBe('')
  })
})
