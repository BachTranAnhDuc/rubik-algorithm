import { Injectable } from '@nestjs/common'
import type { User } from '@prisma/client'
import { PrismaService } from 'nestjs-prisma'

interface UpsertFromGoogleInput {
  googleSub: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromGoogle(input: UpsertFromGoogleInput): Promise<User> {
    const now = new Date()
    return this.prisma.user.upsert({
      where: { googleSub: input.googleSub },
      create: {
        googleSub: input.googleSub,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastLoginAt: now,
      },
      update: {
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastLoginAt: now,
      },
    })
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }
}
