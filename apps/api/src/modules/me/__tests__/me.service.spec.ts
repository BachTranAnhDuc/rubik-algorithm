import { Test } from '@nestjs/testing'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseNotFoundException } from '../../catalog/exceptions'
import { ChosenVariantInvalidException, UserNotFoundException } from '../exceptions'
import { MeService } from '../me.service'

const buildPrismaMock = () => ({
  user: {
    findUniqueOrThrow: vi.fn(),
  },
  algorithmCase: {
    findFirst: vi.fn(),
  },
  algorithmVariant: {
    findFirst: vi.fn(),
  },
  userAlgorithm: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [MeService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(MeService)
}

describe('MeService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('getCurrent', () => {
    it('returns the public user shape via findUniqueOrThrow with select', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z')
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'Ana',
        avatarUrl: null,
        createdAt,
      })
      const service = await compileModule(prisma)

      const result = await service.getCurrent('u1')

      expect(result).toEqual({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'Ana',
        avatarUrl: null,
        createdAt,
      })
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
        },
      })
    })

    it('throws UserNotFoundException when user row missing (P2025)', async () => {
      const notFound = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      })
      prisma.user.findUniqueOrThrow.mockRejectedValue(notFound)
      const service = await compileModule(prisma)

      await expect(service.getCurrent('u1')).rejects.toBeInstanceOf(UserNotFoundException)
    })

    it('rethrows non-P2025 prisma errors', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError('other', {
        code: 'P2002',
        clientVersion: 'test',
      })
      prisma.user.findUniqueOrThrow.mockRejectedValue(otherError)
      const service = await compileModule(prisma)

      await expect(service.getCurrent('u1')).rejects.toBe(otherError)
    })
  })

  describe('listAlgorithms', () => {
    it('returns user algorithms ordered by updatedAt desc', async () => {
      prisma.userAlgorithm.findMany.mockResolvedValue([
        { userId: 'u1', caseId: 'c1', status: 'LEARNING', chosenVariantId: null, personalNotesMd: null, updatedAt: new Date() },
      ])
      const service = await compileModule(prisma)

      await service.listAlgorithms('u1')

      expect(prisma.userAlgorithm.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { updatedAt: 'desc' },
      })
    })
  })

  describe('upsertAlgorithm', () => {
    it('throws CaseNotFoundException when slug does not resolve', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(
        service.upsertAlgorithm('u1', 'unknown-slug', { status: 'LEARNING' }),
      ).rejects.toBeInstanceOf(CaseNotFoundException)
    })

    it('throws ChosenVariantInvalidException when variant does not belong to the case', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.algorithmVariant.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(
        service.upsertAlgorithm('u1', 't-perm', { chosenVariantId: 'v-bad' }),
      ).rejects.toBeInstanceOf(ChosenVariantInvalidException)
      expect(prisma.algorithmVariant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'v-bad', caseId: 'c1' } }),
      )
    })

    it('skips variant validation when chosenVariantId is null', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.userAlgorithm.upsert.mockResolvedValue({
        userId: 'u1',
        caseId: 'c1',
        chosenVariantId: null,
        status: 'LEARNED',
        personalNotesMd: null,
        updatedAt: new Date(),
      })
      const service = await compileModule(prisma)

      await service.upsertAlgorithm('u1', 't-perm', { chosenVariantId: null, status: 'LEARNED' })

      expect(prisma.algorithmVariant.findFirst).not.toHaveBeenCalled()
      expect(prisma.userAlgorithm.upsert).toHaveBeenCalledWith({
        where: { userId_caseId: { userId: 'u1', caseId: 'c1' } },
        create: { userId: 'u1', caseId: 'c1', chosenVariantId: null, status: 'LEARNED' },
        update: { chosenVariantId: null, status: 'LEARNED' },
      })
    })

    it('upserts when slug + variant validate', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.algorithmVariant.findFirst.mockResolvedValue({ id: 'v1' })
      prisma.userAlgorithm.upsert.mockResolvedValue({
        userId: 'u1',
        caseId: 'c1',
        chosenVariantId: 'v1',
        status: 'LEARNING',
        personalNotesMd: 'note',
        updatedAt: new Date(),
      })
      const service = await compileModule(prisma)

      const result = await service.upsertAlgorithm('u1', 't-perm', {
        chosenVariantId: 'v1',
        status: 'LEARNING',
        personalNotesMd: 'note',
      })

      expect(result.chosenVariantId).toBe('v1')
      expect(prisma.userAlgorithm.upsert).toHaveBeenCalledWith({
        where: { userId_caseId: { userId: 'u1', caseId: 'c1' } },
        create: {
          userId: 'u1',
          caseId: 'c1',
          chosenVariantId: 'v1',
          status: 'LEARNING',
          personalNotesMd: 'note',
        },
        update: { chosenVariantId: 'v1', status: 'LEARNING', personalNotesMd: 'note' },
      })
    })
  })

  describe('deleteAlgorithm', () => {
    it('throws CaseNotFoundException when slug does not resolve', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.deleteAlgorithm('u1', 'unknown-slug')).rejects.toBeInstanceOf(
        CaseNotFoundException,
      )
    })

    it('deletes when row exists', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.userAlgorithm.delete.mockResolvedValue({})
      const service = await compileModule(prisma)

      await service.deleteAlgorithm('u1', 't-perm')

      expect(prisma.userAlgorithm.delete).toHaveBeenCalledWith({
        where: { userId_caseId: { userId: 'u1', caseId: 'c1' } },
      })
    })

    it('swallows P2025 (record not found) for idempotency', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      const notFound = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      })
      prisma.userAlgorithm.delete.mockRejectedValue(notFound)
      const service = await compileModule(prisma)

      await expect(service.deleteAlgorithm('u1', 't-perm')).resolves.toBeUndefined()
    })

    it('rethrows non-P2025 prisma errors', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      const otherError = new Prisma.PrismaClientKnownRequestError('other', {
        code: 'P2002',
        clientVersion: 'test',
      })
      prisma.userAlgorithm.delete.mockRejectedValue(otherError)
      const service = await compileModule(prisma)

      await expect(service.deleteAlgorithm('u1', 't-perm')).rejects.toBe(otherError)
    })
  })
})
