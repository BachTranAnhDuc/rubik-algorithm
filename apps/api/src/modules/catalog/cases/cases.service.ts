import { Injectable } from '@nestjs/common'
import type { AlgorithmCaseWithVariants } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { CaseNotFoundException } from '../exceptions'

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCaseBySlug(slug: string): Promise<AlgorithmCaseWithVariants> {
    const caseRow = await this.prisma.algorithmCase.findFirst({
      where: { slug },
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
    })

    if (!caseRow) throw new CaseNotFoundException(slug)
    return caseRow
  }
}
