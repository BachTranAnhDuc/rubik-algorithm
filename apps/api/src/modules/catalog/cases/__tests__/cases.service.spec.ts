import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseNotFoundException } from '../../exceptions'
import { CasesService } from '../cases.service'

const buildPrismaMock = () => ({
  algorithmCase: { findFirst: vi.fn() },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [CasesService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(CasesService)
}

const sampleCase = {
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
}

describe('CasesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('getCaseBySlug', () => {
    it('returns the case with variants ordered by displayOrder', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(sampleCase)
      const service = await compileModule(prisma)

      const result = await service.getCaseBySlug('t-perm')

      expect(result).toEqual(sampleCase)
      expect(prisma.algorithmCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 't-perm' } }),
      )
    })

    it('throws CaseNotFoundException when the slug does not exist', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.getCaseBySlug('nope')).rejects.toBeInstanceOf(CaseNotFoundException)
    })
  })
})
