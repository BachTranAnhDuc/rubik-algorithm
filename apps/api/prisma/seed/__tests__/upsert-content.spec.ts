import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { upsertContent } from '../upsert-content'
import type { ValidatedBundle } from '../validate-content'

const buildPrismaMock = () => ({
  puzzle: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  method: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  algorithmSet: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  algorithmCase: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  algorithmVariant: { deleteMany: vi.fn(), createMany: vi.fn() },
})

const buildBundle = (): ValidatedBundle => ({
  puzzles: [
    {
      filePath: '/p.yaml',
      data: {
        slug: '3x3',
        name: '3x3',
        wca_event_code: '333',
        display_order: 0,
        state_schema_version: 'v1',
      },
    },
  ],
  methods: [
    {
      filePath: '/m.yaml',
      puzzleSlug: '3x3',
      data: { slug: 'cfop', name: 'CFOP', display_order: 0, description_md: null },
    },
  ],
  sets: [
    {
      filePath: '/s.yaml',
      puzzleSlug: '3x3',
      methodSlug: 'cfop',
      data: {
        slug: 'pll',
        name: 'PLL',
        case_count_expected: 21,
        recognition_basis: 'PLL_PERMUTATION',
        display_order: 2,
      },
    },
  ],
  cases: [
    {
      filePath: '/c.yaml',
      puzzleSlug: '3x3',
      methodSlug: 'cfop',
      setSlug: 'pll',
      data: {
        slug: 't-perm',
        name: 'T-Perm',
        display_name: 'T-Perm',
        display_order: 0,
        case_state: 'UUUUUUUUUFFRFFFFFFBLFRRRRRRDDDDDDDDDLRLLLLLLLRBBBBBBBB',
        recognition_md: null,
        tags: ['pll'],
        variants: [
          {
            notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
            is_primary: true,
            attribution: null,
            fingertrick_md: null,
            video_url: null,
          },
        ],
      },
    },
  ],
})

const compileService = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  prismaMock.puzzle.upsert.mockResolvedValue({ id: 'puz_1', slug: '3x3' })
  prismaMock.method.upsert.mockResolvedValue({ id: 'mth_1', slug: 'cfop' })
  prismaMock.algorithmSet.upsert.mockResolvedValue({ id: 'set_1', slug: 'pll' })
  prismaMock.algorithmCase.upsert.mockResolvedValue({ id: 'case_1', slug: 't-perm' })
  prismaMock.algorithmVariant.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.algorithmVariant.createMany.mockResolvedValue({ count: 1 })

  const moduleRef = await Test.createTestingModule({
    providers: [{ provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(PrismaService)
}

describe('upsertContent', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  it('upserts in Puzzle → Method → Set → Case → Variant order', async () => {
    const service = await compileService(prisma)
    const order: string[] = []
    prisma.puzzle.upsert.mockImplementationOnce(async () => {
      order.push('puzzle')
      return { id: 'puz_1', slug: '3x3' }
    })
    prisma.method.upsert.mockImplementationOnce(async () => {
      order.push('method')
      return { id: 'mth_1', slug: 'cfop' }
    })
    prisma.algorithmSet.upsert.mockImplementationOnce(async () => {
      order.push('set')
      return { id: 'set_1', slug: 'pll' }
    })
    prisma.algorithmCase.upsert.mockImplementationOnce(async () => {
      order.push('case')
      return { id: 'case_1', slug: 't-perm' }
    })
    prisma.algorithmVariant.deleteMany.mockImplementationOnce(async () => {
      order.push('variant.deleteMany')
      return { count: 0 }
    })
    prisma.algorithmVariant.createMany.mockImplementationOnce(async () => {
      order.push('variant.createMany')
      return { count: 1 }
    })

    await upsertContent(service, buildBundle(), { prune: false })

    expect(order).toEqual(['puzzle', 'method', 'set', 'case', 'variant.deleteMany', 'variant.createMany'])
  })

  it('replaces variants per case via deleteMany + createMany', async () => {
    const service = await compileService(prisma)

    await upsertContent(service, buildBundle(), { prune: false })

    expect(prisma.algorithmVariant.deleteMany).toHaveBeenCalledWith({ where: { caseId: 'case_1' } })
    expect(prisma.algorithmVariant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          caseId: 'case_1',
          notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
          isPrimary: true,
        }),
      ],
    })
  })

  it('does NOT delete orphan rows when prune is false', async () => {
    const service = await compileService(prisma)
    prisma.algorithmCase.findMany.mockResolvedValueOnce([
      { id: 'old_case', slug: 'old-case', setId: 'set_1' },
    ])

    await upsertContent(service, buildBundle(), { prune: false })

    expect(prisma.algorithmCase.deleteMany).not.toHaveBeenCalled()
    expect(prisma.algorithmSet.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes orphan rows when prune is true', async () => {
    const service = await compileService(prisma)
    prisma.algorithmCase.findMany.mockResolvedValueOnce([
      { id: 'orphan_case', slug: 'old-case', setId: 'set_1' },
      { id: 'case_1', slug: 't-perm', setId: 'set_1' },
    ])

    await upsertContent(service, buildBundle(), { prune: true })

    expect(prisma.algorithmCase.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['orphan_case'] } },
    })
  })
})
