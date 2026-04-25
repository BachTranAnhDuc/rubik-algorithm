import { Injectable } from '@nestjs/common'
import type { AlgorithmSet } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { MethodNotFoundException, PuzzleNotFoundException } from '../exceptions'

@Injectable()
export class MethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSetsForMethod(puzzleSlug: string, methodSlug: string): Promise<AlgorithmSet[]> {
    const puzzle = await this.prisma.puzzle.findUnique({
      where: { slug: puzzleSlug },
      select: { id: true },
    })
    if (!puzzle) throw new PuzzleNotFoundException(puzzleSlug)

    const method = await this.prisma.method.findUnique({
      where: { puzzleId_slug: { puzzleId: puzzle.id, slug: methodSlug } },
      select: { id: true },
    })
    if (!method) throw new MethodNotFoundException(puzzleSlug, methodSlug)

    return this.prisma.algorithmSet.findMany({
      where: { methodId: method.id },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        methodId: true,
        slug: true,
        name: true,
        caseCountExpected: true,
        recognitionBasis: true,
        displayOrder: true,
      },
    })
  }
}
