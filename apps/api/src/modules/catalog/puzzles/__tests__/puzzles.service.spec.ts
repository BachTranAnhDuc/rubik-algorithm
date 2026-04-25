import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PuzzleNotFoundException } from '../../exceptions'
import { PuzzlesService } from '../puzzles.service'

const buildPrismaMock = () => ({
  puzzle: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  method: {
    findMany: vi.fn(),
  },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [PuzzlesService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(PuzzlesService)
}

describe('PuzzlesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('listPuzzles', () => {
    it('returns puzzles ordered by displayOrder', async () => {
      prisma.puzzle.findMany.mockResolvedValue([
        { id: 'p1', slug: '3x3', name: '3x3 Cube', wcaEventCode: '333', displayOrder: 0 },
      ])
      const service = await compileModule(prisma)

      const result = await service.listPuzzles()

      expect(result).toEqual([
        { id: 'p1', slug: '3x3', name: '3x3 Cube', wcaEventCode: '333', displayOrder: 0 },
      ])
      expect(prisma.puzzle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { displayOrder: 'asc' } }),
      )
    })
  })

  describe('listMethodsForPuzzle', () => {
    it('returns methods for an existing puzzle ordered by displayOrder', async () => {
      prisma.puzzle.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.method.findMany.mockResolvedValue([
        {
          id: 'm1',
          puzzleId: 'p1',
          slug: 'cfop',
          name: 'CFOP',
          descriptionMd: null,
          displayOrder: 0,
        },
      ])
      const service = await compileModule(prisma)

      const result = await service.listMethodsForPuzzle('3x3')

      expect(result).toEqual([
        {
          id: 'm1',
          puzzleId: 'p1',
          slug: 'cfop',
          name: 'CFOP',
          descriptionMd: null,
          displayOrder: 0,
        },
      ])
      expect(prisma.method.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { puzzleId: 'p1' }, orderBy: { displayOrder: 'asc' } }),
      )
    })

    it('throws PuzzleNotFoundException when the puzzle slug does not exist', async () => {
      prisma.puzzle.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.listMethodsForPuzzle('nope')).rejects.toBeInstanceOf(PuzzleNotFoundException)
      expect(prisma.method.findMany).not.toHaveBeenCalled()
    })
  })
})
