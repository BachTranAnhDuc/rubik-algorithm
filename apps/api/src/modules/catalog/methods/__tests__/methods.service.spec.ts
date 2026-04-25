import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MethodNotFoundException, PuzzleNotFoundException } from '../../exceptions'
import { MethodsService } from '../methods.service'

const buildPrismaMock = () => ({
  puzzle: { findUnique: vi.fn() },
  method: { findUnique: vi.fn() },
  algorithmSet: { findMany: vi.fn() },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [MethodsService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(MethodsService)
}

describe('MethodsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('listSetsForMethod', () => {
    it('returns sets for an existing puzzle/method pair', async () => {
      prisma.puzzle.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.method.findUnique.mockResolvedValue({ id: 'm1' })
      prisma.algorithmSet.findMany.mockResolvedValue([
        {
          id: 's1',
          methodId: 'm1',
          slug: 'pll',
          name: 'PLL',
          caseCountExpected: 21,
          recognitionBasis: 'PLL_PERMUTATION',
          displayOrder: 3,
        },
      ])
      const service = await compileModule(prisma)

      const result = await service.listSetsForMethod('3x3', 'cfop')

      expect(result).toEqual([
        {
          id: 's1',
          methodId: 'm1',
          slug: 'pll',
          name: 'PLL',
          caseCountExpected: 21,
          recognitionBasis: 'PLL_PERMUTATION',
          displayOrder: 3,
        },
      ])
      expect(prisma.algorithmSet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { methodId: 'm1' }, orderBy: { displayOrder: 'asc' } }),
      )
    })

    it('throws PuzzleNotFoundException when the puzzle is missing', async () => {
      prisma.puzzle.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.listSetsForMethod('nope', 'cfop')).rejects.toBeInstanceOf(PuzzleNotFoundException)
      expect(prisma.method.findUnique).not.toHaveBeenCalled()
    })

    it('throws MethodNotFoundException when the method is missing', async () => {
      prisma.puzzle.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.method.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.listSetsForMethod('3x3', 'nope')).rejects.toBeInstanceOf(MethodNotFoundException)
      expect(prisma.algorithmSet.findMany).not.toHaveBeenCalled()
    })
  })
})
