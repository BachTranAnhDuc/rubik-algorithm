import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchService } from '../search.service'

const buildPrismaMock = () => ({
  $queryRaw: vi.fn(),
})

const compileService = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [SearchService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(SearchService)
}

const ftsRow = (overrides: Record<string, unknown> = {}) => ({
  caseId: 'c-1',
  caseSlug: 't-perm',
  caseName: 'T-Perm',
  setSlug: 'pll',
  methodSlug: 'cfop',
  puzzleSlug: '3x3',
  rank: 0.06,
  ...overrides,
})

describe('SearchService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  it('returns FTS hits with matchHighlight: null when FTS finds matches', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([ftsRow()])
    const service = await compileService(prisma)

    const result = await service.search('t-perm', 20)

    expect(result.query).toBe('t-perm')
    expect(result.hits).toEqual([
      {
        caseId: 'c-1',
        caseSlug: 't-perm',
        caseName: 'T-Perm',
        setSlug: 'pll',
        methodSlug: 'cfop',
        puzzleSlug: '3x3',
        rank: 0.06,
        matchHighlight: null,
      },
    ])
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('falls back to trigram when FTS returns empty', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ftsRow({ caseSlug: 't-perm', rank: 0.45 })])
    const service = await compileService(prisma)

    const result = await service.search('tperm', 20)

    expect(result.hits).toHaveLength(1)
    expect(result.hits[0]?.caseSlug).toBe('t-perm')
    expect(result.hits[0]?.rank).toBe(0.45)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('returns empty hits when both FTS and trigram find nothing', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const service = await compileService(prisma)

    const result = await service.search('zzzzz', 20)

    expect(result).toEqual({ query: 'zzzzz', hits: [] })
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
  })

  it('passes limit through to both query phases', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const service = await compileService(prisma)

    await service.search('zzzzz', 5)

    const firstCall = prisma.$queryRaw.mock.calls[0]
    const secondCall = prisma.$queryRaw.mock.calls[1]
    expect(JSON.stringify(firstCall)).toContain('5')
    expect(JSON.stringify(secondCall)).toContain('5')
  })
})
