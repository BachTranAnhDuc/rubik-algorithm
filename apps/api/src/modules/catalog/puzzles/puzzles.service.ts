import { Injectable } from '@nestjs/common'
import type { Method, Puzzle } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { PuzzleNotFoundException } from '../exceptions'

@Injectable()
export class PuzzlesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPuzzles(): Promise<Puzzle[]> {
    return this.prisma.puzzle.findMany({
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        wcaEventCode: true,
        displayOrder: true,
      },
    })
  }

  async listMethodsForPuzzle(puzzleSlug: string): Promise<Method[]> {
    const puzzle = await this.prisma.puzzle.findUnique({
      where: { slug: puzzleSlug },
      select: { id: true },
    })
    if (!puzzle) throw new PuzzleNotFoundException(puzzleSlug)

    return this.prisma.method.findMany({
      where: { puzzleId: puzzle.id },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        puzzleId: true,
        slug: true,
        name: true,
        descriptionMd: true,
        displayOrder: true,
      },
    })
  }
}
