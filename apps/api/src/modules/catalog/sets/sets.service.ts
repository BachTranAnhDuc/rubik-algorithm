import { Injectable } from '@nestjs/common'
import type { AlgorithmSetWithCases } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { SetNotFoundException } from '../exceptions'

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSetBySlug(slug: string): Promise<AlgorithmSetWithCases> {
    const set = await this.prisma.algorithmSet.findFirst({
      where: { slug },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        methodId: true,
        slug: true,
        name: true,
        caseCountExpected: true,
        recognitionBasis: true,
        displayOrder: true,
        cases: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            setId: true,
            slug: true,
            name: true,
            displayName: true,
            displayOrder: true,
            caseState: true,
            recognitionMd: true,
            tags: true,
            variants: {
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true,
                caseId: true,
                notation: true,
                moveCountHtm: true,
                moveCountStm: true,
                isPrimary: true,
                attribution: true,
                fingertrickMd: true,
                displayOrder: true,
              },
            },
          },
        },
      },
    })

    if (!set) throw new SetNotFoundException(slug)
    return set
  }
}
