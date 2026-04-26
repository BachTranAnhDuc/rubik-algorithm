import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthService } from '../auth.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from '../exceptions'
import { GoogleVerifierService } from '../google/google-verifier.service'
import { TokenService } from '../token.service'
import { UsersService } from '../../users/users.service'

const buildPrismaMock = () => ({
  refreshToken: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      refreshToken: {
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    }),
  ),
})

const buildVerifierMock = () => ({ verify: vi.fn() })
const buildUsersMock = () => ({ upsertFromGoogle: vi.fn(), findById: vi.fn() })
const buildTokensMock = () => ({
  issuePair: vi.fn(),
  verifyRefresh: vi.fn(),
  hashToken: vi.fn((t: string) => `hash-of-${t}`),
})

const compileModule = async (
  prisma: ReturnType<typeof buildPrismaMock>,
  verifier: ReturnType<typeof buildVerifierMock>,
  users: ReturnType<typeof buildUsersMock>,
  tokens: ReturnType<typeof buildTokensMock>,
) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: GoogleVerifierService, useValue: verifier },
      { provide: UsersService, useValue: users },
      { provide: TokenService, useValue: tokens },
    ],
  }).compile()
  return moduleRef.get(AuthService)
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>
  let verifier: ReturnType<typeof buildVerifierMock>
  let users: ReturnType<typeof buildUsersMock>
  let tokens: ReturnType<typeof buildTokensMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
    verifier = buildVerifierMock()
    users = buildUsersMock()
    tokens = buildTokensMock()
  })

  describe('loginWithGoogle', () => {
    it('verifies, upserts the user, and issues a token pair', async () => {
      verifier.verify.mockResolvedValue({
        sub: 'g-1',
        email: 'a@b.com',
        name: 'Ana',
        picture: 'https://x/y.png',
      })
      users.upsertFromGoogle.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      tokens.issuePair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 })
      const service = await compileModule(prisma, verifier, users, tokens)

      const pair = await service.loginWithGoogle(
        { idToken: 'id-token' },
        { userAgent: 'curl/8.0', ip: '127.0.0.1' },
      )

      expect(verifier.verify).toHaveBeenCalledWith('id-token')
      expect(users.upsertFromGoogle).toHaveBeenCalledWith({
        googleSub: 'g-1',
        email: 'a@b.com',
        displayName: 'Ana',
        avatarUrl: 'https://x/y.png',
      })
      expect(tokens.issuePair).toHaveBeenCalledWith(
        { id: 'u1', email: 'a@b.com' },
        { userAgent: 'curl/8.0', ip: '127.0.0.1' },
      )
      expect(pair).toEqual({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 })
    })
  })

  describe('rotate', () => {
    it('rejects when the refresh row does not exist', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })

    it('rejects when the refresh row is already revoked', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })

    it('rejects when sub mismatches the row userId', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'someone-else',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })

    it('rejects when the row is past its expiresAt', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(RefreshExpiredException)
    })

    it('revokes old row and issues new pair atomically when valid', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      tokens.issuePair.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 })
      const service = await compileModule(prisma, verifier, users, tokens)

      const pair = await service.rotate('refresh-token', { userAgent: 'ua', ip: '1.1.1.1' })

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(tokens.issuePair).toHaveBeenCalledWith(
        { id: 'u1', email: 'a@b.com' },
        { userAgent: 'ua', ip: '1.1.1.1' },
        expect.any(Object),
      )
      expect(pair).toEqual({ accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 })
    })

    it('rejects when users.findById returns null', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      users.findById.mockResolvedValue(null)
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })
  })

  describe('logout', () => {
    it('marks the row revokedAt when valid and not yet revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await service.logout('refresh-token')

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      })
    })

    it('is idempotent when the row is already revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.logout('refresh-token')).resolves.toBeUndefined()
      expect(prisma.refreshToken.update).not.toHaveBeenCalled()
    })

    it('is idempotent when the row does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.logout('refresh-token')).resolves.toBeUndefined()
      expect(prisma.refreshToken.update).not.toHaveBeenCalled()
    })
  })
})
