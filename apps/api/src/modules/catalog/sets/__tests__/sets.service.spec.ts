import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SetNotFoundException } from '../../exceptions'
import { SetsService } from '../sets.service'

const buildPrismaMock = () => ({
  algorithmSet: { findFirst: vi.fn() },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [SetsService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(SetsService)
}

const sampleSetWithCases = {
  id: 's1',
  methodId: 'm1',
  slug: 'pll',
  name: 'PLL',
  caseCountExpected: 21,
  recognitionBasis: 'PLL_PERMUTATION' as const,
  displayOrder: 3,
  cases: [
    {
      id: 'c1',
      setId: 's1',
      slug: 't-perm',
      name: 'T Perm',
      displayName: 'T-Perm',
      displayOrder: 14,
      caseState: 'x'.repeat(54),
      recognitionMd: null,
      tags: ['adjacent-corner-swap'],
      variants: [
        {
          id: 'v1',
          caseId: 'c1',
          notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
          moveCountHtm: 14,
          moveCountStm: 14,
          isPrimary: true,
          attribution: null,
          fingertrickMd: null,
          displayOrder: 0,
        },
      ],
    },
  ],
}

describe('SetsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('getSetBySlug', () => {
    it('returns the set with denormalized cases and variants', async () => {
      prisma.algorithmSet.findFirst.mockResolvedValue(sampleSetWithCases)
      const service = await compileModule(prisma)

      const result = await service.getSetBySlug('pll')

      expect(result).toEqual(sampleSetWithCases)
      expect(prisma.algorithmSet.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'pll' }, orderBy: { displayOrder: 'asc' } }),
      )
    })

    it('throws SetNotFoundException when the slug does not exist', async () => {
      prisma.algorithmSet.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.getSetBySlug('nope')).rejects.toBeInstanceOf(SetNotFoundException)
    })
  })
})
