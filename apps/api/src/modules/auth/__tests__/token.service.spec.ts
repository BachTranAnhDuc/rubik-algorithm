import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigService } from '../../../infra/config/config.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from '../exceptions'
import { TokenService } from '../token.service'

const ACCESS_SECRET = 'a'.repeat(32)
const REFRESH_SECRET = 'r'.repeat(32)

const buildConfigMock = () => ({
  get: vi.fn((key: string) => {
    if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET
    if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET
    return undefined
  }),
})

const buildPrismaMock = () => ({
  refreshToken: {
    create: vi.fn(),
  },
})

const compileModule = async (prisma: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TokenService,
      JwtService,
      { provide: ConfigService, useValue: buildConfigMock() },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile()
  return { service: moduleRef.get(TokenService), jwt: moduleRef.get(JwtService) }
}

describe('TokenService', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('issuePair', () => {
    it('signs an access JWT and a refresh JWT and persists the refresh hash', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service, jwt } = await compileModule(prisma)

      const pair = await service.issuePair(
        { id: 'u1', email: 'a@b.com' },
        { userAgent: 'curl/8.0', ip: '127.0.0.1' },
      )

      expect(pair.expiresIn).toBe(900)
      expect(pair.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
      expect(pair.refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)

      const accessPayload = jwt.verify<{ sub: string; email: string }>(pair.accessToken, {
        secret: ACCESS_SECRET,
      })
      expect(accessPayload).toMatchObject({ sub: 'u1', email: 'a@b.com' })

      const refreshPayload = jwt.verify<{ sub: string }>(pair.refreshToken, {
        secret: REFRESH_SECRET,
      })
      expect(refreshPayload.sub).toBe('u1')

      const createCall = prisma.refreshToken.create.mock.calls[0][0]
      expect(createCall.data).toMatchObject({
        userId: 'u1',
        userAgent: 'curl/8.0',
        ip: '127.0.0.1',
      })
      expect(createCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/)
      expect(createCall.data.tokenHash).toBe(service.hashToken(pair.refreshToken))
    })

    it('uses the provided Prisma transaction client when given', async () => {
      const txCreate = vi.fn().mockResolvedValue({})
      const tx = { refreshToken: { create: txCreate } }
      const prisma = buildPrismaMock()
      const { service } = await compileModule(prisma)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.issuePair({ id: 'u1', email: 'a@b.com' }, undefined, tx as any)

      expect(txCreate).toHaveBeenCalledTimes(1)
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })
  })

  describe('verifyRefresh', () => {
    it('returns sub from a valid refresh token', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service } = await compileModule(prisma)

      const pair = await service.issuePair({ id: 'u1', email: 'a@b.com' })
      const decoded = service.verifyRefresh(pair.refreshToken)

      expect(decoded).toEqual({ sub: 'u1' })
    })

    it('throws InvalidRefreshTokenException for a tampered token', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service } = await compileModule(prisma)

      const pair = await service.issuePair({ id: 'u1', email: 'a@b.com' })
      const tampered = pair.refreshToken.slice(0, -1) + (pair.refreshToken.slice(-1) === 'a' ? 'b' : 'a')

      expect(() => service.verifyRefresh(tampered)).toThrow(InvalidRefreshTokenException)
    })

    it('throws RefreshExpiredException for an expired token', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service } = await compileModule(prisma)

      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const pair = await service.issuePair({ id: 'u1', email: 'a@b.com' })

      vi.setSystemTime(new Date('2026-03-01T00:00:00Z'))
      expect(() => service.verifyRefresh(pair.refreshToken)).toThrow(RefreshExpiredException)
    })
  })

  describe('hashToken', () => {
    it('produces a stable 64-char hex SHA-256 digest', async () => {
      const prisma = buildPrismaMock()
      const { service } = await compileModule(prisma)

      const hash1 = service.hashToken('hello')
      const hash2 = service.hashToken('hello')

      expect(hash1).toMatch(/^[a-f0-9]{64}$/)
      expect(hash1).toBe(hash2)
      expect(service.hashToken('world')).not.toBe(hash1)
    })
  })
})
