import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { JwtService, TokenExpiredError } from '@nestjs/jwt'
import type { Prisma } from '@prisma/client'
import type { TokenPair } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { ConfigService } from '../../infra/config/config.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from './exceptions'

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

export type { TokenPair }

export interface TokenContext {
  userAgent?: string | null
  ip?: string | null
}

type PrismaWriter = Pick<PrismaService, 'refreshToken'> | Prisma.TransactionClient

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issuePair(
    user: { id: string; email: string },
    ctx?: TokenContext,
    client: PrismaWriter = this.prisma,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    )
    const refreshToken = this.jwt.sign(
      { sub: user.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    )
    const tokenHash = this.hashToken(refreshToken)
    await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        userAgent: ctx?.userAgent ?? null,
        ip: ctx?.ip ?? null,
      },
    })
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  }

  verifyRefresh(token: string): { sub: string } {
    try {
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      })
      return { sub: payload.sub }
    } catch (err) {
      if (err instanceof TokenExpiredError) throw new RefreshExpiredException()
      throw new InvalidRefreshTokenException()
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
