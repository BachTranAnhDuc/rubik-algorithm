import { Injectable } from '@nestjs/common'
import type { GoogleLogin, TokenPair } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { UsersService } from '../users/users.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from './exceptions'
import { GoogleVerifierService } from './google/google-verifier.service'
import type { TokenContext } from './token.service'
import { TokenService } from './token.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleVerifier: GoogleVerifierService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async loginWithGoogle(input: GoogleLogin, ctx?: TokenContext): Promise<TokenPair> {
    const profile = await this.googleVerifier.verify(input.idToken)
    const user = await this.users.upsertFromGoogle({
      googleSub: profile.sub,
      email: profile.email,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    })
    return this.tokens.issuePair({ id: user.id, email: user.email }, ctx)
  }

  async rotate(refreshToken: string, ctx?: TokenContext): Promise<TokenPair> {
    const { sub } = this.tokens.verifyRefresh(refreshToken)
    const tokenHash = this.tokens.hashToken(refreshToken)
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!row || row.userId !== sub || row.revokedAt) {
      throw new InvalidRefreshTokenException()
    }
    if (row.expiresAt < new Date()) {
      throw new RefreshExpiredException()
    }
    const user = await this.users.findById(sub)
    if (!user) {
      throw new InvalidRefreshTokenException()
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      })
      return this.tokens.issuePair({ id: user.id, email: user.email }, ctx, tx)
    })
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashToken(refreshToken)
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!row || row.revokedAt) return
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    })
  }
}
