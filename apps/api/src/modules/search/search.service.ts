import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { SearchHit, SearchResult } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

interface FtsRow {
  caseId: string
  caseSlug: string
  caseName: string
  setSlug: string
  methodSlug: string
  puzzleSlug: string
  rank: number
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, limit: number): Promise<SearchResult> {
    const ftsHits = await this.runFts(q, limit)
    if (ftsHits.length > 0) {
      return { query: q, hits: ftsHits }
    }
    const trigramHits = await this.runTrigram(q, limit)
    return { query: q, hits: trigramHits }
  }

  private async runFts(q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.$queryRaw<FtsRow[]>(Prisma.sql`
      SELECT
        c.id AS "caseId",
        c.slug AS "caseSlug",
        c.name AS "caseName",
        s.slug AS "setSlug",
        m.slug AS "methodSlug",
        p.slug AS "puzzleSlug",
        ts_rank_cd(c.search_vector, plainto_tsquery('english', ${q})) AS rank
      FROM algorithm_cases c
      JOIN algorithm_sets s ON c."setId" = s.id
      JOIN methods m ON s."methodId" = m.id
      JOIN puzzles p ON m."puzzleId" = p.id
      WHERE c.search_vector @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC, c."displayOrder" ASC
      LIMIT ${limit}
    `)
    return rows.map((r) => ({ ...r, matchHighlight: null }))
  }

  private async runTrigram(q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.prisma.$queryRaw<FtsRow[]>(Prisma.sql`
      SELECT
        c.id AS "caseId",
        c.slug AS "caseSlug",
        c.name AS "caseName",
        s.slug AS "setSlug",
        m.slug AS "methodSlug",
        p.slug AS "puzzleSlug",
        similarity(coalesce(c.name, '') || ' ' || coalesce(c."displayName", ''), ${q}) AS rank
      FROM algorithm_cases c
      JOIN algorithm_sets s ON c."setId" = s.id
      JOIN methods m ON s."methodId" = m.id
      JOIN puzzles p ON m."puzzleId" = p.id
      WHERE c.name % ${q} OR c."displayName" % ${q}
      ORDER BY rank DESC, c."displayOrder" ASC
      LIMIT ${limit}
    `)
    return rows.map((r) => ({ ...r, matchHighlight: null }))
  }
}
