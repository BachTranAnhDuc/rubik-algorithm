import { Injectable } from '@nestjs/common'
import {
  formatAlgorithm,
  scrambleIntoCase,
  wcaScramble,
} from '@rubik/cube-core'
import type { ScrambleResult } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { CaseNotFoundException } from '../catalog/exceptions'

interface RandomScrambleInput {
  puzzle: '3x3'
  seed?: string
}

// FNV-1a 32-bit hash. Maps any UTF-8 string to a stable uint32 so user-supplied
// seed strings can drive cube-core's numeric mulberry32 PRNG seed slot. Pure;
// no allocations beyond the 4-byte accumulator.
const fnv1a32 = (s: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

@Injectable()
export class ScrambleService {
  constructor(private readonly prisma: PrismaService) {}

  randomScramble(input: RandomScrambleInput): ScrambleResult {
    const numericSeed = input.seed !== undefined ? fnv1a32(input.seed) : undefined
    const moves =
      numericSeed !== undefined
        ? wcaScramble({ seed: numericSeed })
        : wcaScramble()
    return {
      puzzle: input.puzzle,
      scramble: formatAlgorithm(moves),
      seed: input.seed ?? null,
    }
  }

  async scrambleForCase(caseSlug: string): Promise<ScrambleResult> {
    const row = await this.prisma.algorithmCase.findFirst({
      where: { slug: caseSlug },
      select: {
        variants: {
          where: { isPrimary: true },
          select: { notation: true },
          take: 1,
        },
        set: {
          select: {
            method: {
              select: { puzzle: { select: { slug: true } } },
            },
          },
        },
      },
    })
    if (!row) throw new CaseNotFoundException(caseSlug)

    const primary = row.variants[0]
    if (!primary) {
      throw new Error(`case ${caseSlug} has no is_primary variant (schema invariant violated)`)
    }

    const moves = scrambleIntoCase(primary.notation)
    return {
      puzzle: row.set.method.puzzle.slug as '3x3',
      scramble: formatAlgorithm(moves),
      seed: null,
    }
  }
}
