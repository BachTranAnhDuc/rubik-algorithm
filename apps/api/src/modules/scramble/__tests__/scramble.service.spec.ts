import { Test } from '@nestjs/testing'
import { applyAlgorithm, fromStickerString, parseAlgorithm, SOLVED_STATE, stateEquals } from '@rubik/cube-core'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseNotFoundException } from '../../catalog/exceptions'
import { ScrambleService } from '../scramble.service'

const TPERM_NOTATION = "R U R' U' R' F R2 U' R' U' R U R' F'"
const TPERM_STATE = 'UUUUUUUUUFFRFFFFFFBLFRRRRRRDDDDDDDDDLRLLLLLLLRBBBBBBBB'

const buildPrismaMock = () => ({
  algorithmCase: {
    findFirst: vi.fn(),
  },
})

const compileService = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [ScrambleService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(ScrambleService)
}

describe('ScrambleService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('randomScramble', () => {
    it('returns a non-empty scramble string for 3x3', async () => {
      const service = await compileService(prisma)
      const result = await service.randomScramble({ puzzle: '3x3' })

      expect(result.puzzle).toBe('3x3')
      expect(result.scramble).toMatch(/^[URLDFB][2']?(\s+[URLDFB][2']?)+$/)
      expect(result.seed).toBeNull()
    })

    it('produces identical scrambles for the same seed string', async () => {
      const service = await compileService(prisma)
      const a = await service.randomScramble({ puzzle: '3x3', seed: 'hello' })
      const b = await service.randomScramble({ puzzle: '3x3', seed: 'hello' })

      expect(a.scramble).toBe(b.scramble)
      expect(a.seed).toBe('hello')
    })

    it('produces different scrambles for different seeds', async () => {
      const service = await compileService(prisma)
      const a = await service.randomScramble({ puzzle: '3x3', seed: 'hello' })
      const b = await service.randomScramble({ puzzle: '3x3', seed: 'world' })

      expect(a.scramble).not.toBe(b.scramble)
    })
  })

  describe('scrambleForCase', () => {
    it('returns the inverse of the primary variant notation', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({
        variants: [{ notation: TPERM_NOTATION }],
        set: { method: { puzzle: { slug: '3x3' } } },
      })
      const service = await compileService(prisma)

      const result = await service.scrambleForCase('t-perm')

      expect(result.puzzle).toBe('3x3')
      expect(result.seed).toBeNull()
      expect(result.scramble).toMatch(/[URLDFB]/)

      const finalState = applyAlgorithm(SOLVED_STATE, parseAlgorithm(result.scramble))
      expect(stateEquals(finalState, fromStickerString(TPERM_STATE))).toBe(true)
    })

    it('throws CaseNotFoundException when slug does not resolve', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileService(prisma)

      await expect(service.scrambleForCase('unknown')).rejects.toBeInstanceOf(CaseNotFoundException)
    })

    it('queries on the slug with the right nested select', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({
        variants: [{ notation: TPERM_NOTATION }],
        set: { method: { puzzle: { slug: '3x3' } } },
      })
      const service = await compileService(prisma)

      await service.scrambleForCase('t-perm')

      expect(prisma.algorithmCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 't-perm' },
          select: expect.objectContaining({
            variants: expect.objectContaining({
              where: { isPrimary: true },
              take: 1,
            }),
          }),
        }),
      )
    })
  })
})
