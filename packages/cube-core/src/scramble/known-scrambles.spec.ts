import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { applyAlgorithm, invertAlgorithm } from '../algorithm/operations'
import { SOLVED_STATE, isSolved } from '../state/sticker-model'

interface KnownScramble {
  readonly seed: number
  readonly scramble: string
  readonly state: string
  readonly solution: string
}

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = resolve(here, '../../fixtures/known-scrambles.json')
const KNOWN: readonly KnownScramble[] = JSON.parse(readFileSync(fixturePath, 'utf8'))

describe('known-scrambles fixture', () => {
  it('has at least 20 entries', () => {
    expect(KNOWN.length).toBeGreaterThanOrEqual(20)
  })

  it.each(KNOWN)(
    'seed $seed: applying scramble produces stored state',
    ({ scramble, state }) => {
      expect(applyAlgorithm(SOLVED_STATE, scramble)).toBe(state)
    },
  )

  it.each(KNOWN)(
    'seed $seed: solution is the scramble inverse — applying it returns to solved',
    ({ scramble, solution }) => {
      expect(solution).toBe(
        invertAlgorithm(scramble)
          .map((m) => `${m.axis}${m.wide ? 'w' : ''}${m.amount === 1 ? '' : m.amount === 2 ? '2' : "'"}`)
          .join(' '),
      )
      const scrambled = applyAlgorithm(SOLVED_STATE, scramble)
      const solved = applyAlgorithm(scrambled, solution)
      expect(isSolved(solved)).toBe(true)
    },
  )
})
