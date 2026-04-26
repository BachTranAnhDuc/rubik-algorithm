import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersService } from '../users.service'

const buildPrismaMock = () => ({
  user: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(UsersService)
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('upsertFromGoogle', () => {
    it('creates a new user when googleSub is unknown', async () => {
      prisma.user.upsert.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        googleSub: 'g-1',
        displayName: 'Ana',
        avatarUrl: null,
      })
      const service = await compileModule(prisma)

      const user = await service.upsertFromGoogle({
        googleSub: 'g-1',
        email: 'a@b.com',
        displayName: 'Ana',
        avatarUrl: null,
      })

      expect(user.id).toBe('u1')
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { googleSub: 'g-1' },
          create: expect.objectContaining({ googleSub: 'g-1', email: 'a@b.com', displayName: 'Ana' }),
          update: expect.objectContaining({
            email: 'a@b.com',
            displayName: 'Ana',
            avatarUrl: null,
            lastLoginAt: expect.any(Date),
          }),
        }),
      )
    })

    it('updates lastLoginAt and profile fields on a returning user', async () => {
      prisma.user.upsert.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        googleSub: 'g-1',
        displayName: 'Ana Updated',
        avatarUrl: 'https://x/y.png',
      })
      const service = await compileModule(prisma)

      await service.upsertFromGoogle({
        googleSub: 'g-1',
        email: 'a@b.com',
        displayName: 'Ana Updated',
        avatarUrl: 'https://x/y.png',
      })

      const call = prisma.user.upsert.mock.calls[0][0]
      expect(call.update.lastLoginAt).toBeInstanceOf(Date)
    })
  })

  describe('findById', () => {
    it('returns the user when it exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      const service = await compileModule(prisma)

      const user = await service.findById('u1')

      expect(user).toEqual({ id: 'u1', email: 'a@b.com' })
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } })
    })

    it('returns null when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      expect(await service.findById('missing')).toBeNull()
    })
  })
})
