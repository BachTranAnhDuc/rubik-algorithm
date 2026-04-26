import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { UpdateUserAlgorithm, User, UserAlgorithm } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { CaseNotFoundException } from '../catalog/exceptions'
import { ChosenVariantInvalidException, UserNotFoundException } from './exceptions'

type AlgorithmDataPatch = {
  status?: NonNullable<UpdateUserAlgorithm['status']>
  chosenVariantId?: string | null
  personalNotesMd?: string | null
}

const buildAlgorithmData = (body: UpdateUserAlgorithm): AlgorithmDataPatch => {
  const data: AlgorithmDataPatch = {}
  if (body.status !== undefined) data.status = body.status
  if (body.chosenVariantId !== undefined) data.chosenVariantId = body.chosenVariantId
  if (body.personalNotesMd !== undefined) data.personalNotesMd = body.personalNotesMd
  return data
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string): Promise<User> {
    try {
      const row = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
        },
      })
      return { ...row, createdAt: row.createdAt.toISOString() }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new UserNotFoundException(userId)
      }
      throw err
    }
  }

  async listAlgorithms(userId: string): Promise<UserAlgorithm[]> {
    const rows = await this.prisma.userAlgorithm.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        caseId: true,
        chosenVariantId: true,
        status: true,
        personalNotesMd: true,
        updatedAt: true,
      },
    })
    return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }))
  }

  async upsertAlgorithm(
    userId: string,
    caseSlug: string,
    body: UpdateUserAlgorithm,
  ): Promise<UserAlgorithm> {
    const c = await this.prisma.algorithmCase.findFirst({
      where: { slug: caseSlug },
      select: { id: true },
    })
    if (!c) throw new CaseNotFoundException(caseSlug)
    const caseId = c.id

    if (body.chosenVariantId != null) {
      const variant = await this.prisma.algorithmVariant.findFirst({
        where: { id: body.chosenVariantId, caseId },
        select: { id: true },
      })
      if (!variant) throw new ChosenVariantInvalidException(body.chosenVariantId, caseId)
    }

    const data = buildAlgorithmData(body)
    const row = await this.prisma.userAlgorithm.upsert({
      where: { userId_caseId: { userId, caseId } },
      create: { userId, caseId, ...data },
      update: { ...data },
      select: {
        caseId: true,
        chosenVariantId: true,
        status: true,
        personalNotesMd: true,
        updatedAt: true,
      },
    })
    return { ...row, updatedAt: row.updatedAt.toISOString() }
  }

  async deleteAlgorithm(userId: string, caseSlug: string): Promise<void> {
    const c = await this.prisma.algorithmCase.findFirst({
      where: { slug: caseSlug },
      select: { id: true },
    })
    if (!c) throw new CaseNotFoundException(caseSlug)

    try {
      await this.prisma.userAlgorithm.delete({
        where: { userId_caseId: { userId, caseId: c.id } },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return
      throw err
    }
  }
}
