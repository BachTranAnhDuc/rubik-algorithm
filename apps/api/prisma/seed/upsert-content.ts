import { htm, parseAlgorithm, stm } from '@rubik/cube-core'
import type { PrismaService } from 'nestjs-prisma'

import type { ValidatedBundle } from './validate-content'

export interface UpsertOptions {
  prune: boolean
}

export interface UpsertResult {
  puzzles: { upserted: number; pruned: number }
  methods: { upserted: number; pruned: number }
  sets: { upserted: number; pruned: number }
  cases: { upserted: number; pruned: number }
  variants: { written: number }
}

const upsertPuzzles = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
): Promise<Map<string, string>> => {
  const slugToId = new Map<string, string>()
  for (const p of bundle.puzzles) {
    const row = await prisma.puzzle.upsert({
      where: { slug: p.data.slug },
      create: {
        slug: p.data.slug,
        name: p.data.name,
        wcaEventCode: p.data.wca_event_code ?? null,
        displayOrder: p.data.display_order,
        stateSchemaVersion: p.data.state_schema_version,
      },
      update: {
        name: p.data.name,
        wcaEventCode: p.data.wca_event_code ?? null,
        displayOrder: p.data.display_order,
        stateSchemaVersion: p.data.state_schema_version,
      },
      select: { id: true, slug: true },
    })
    slugToId.set(row.slug, row.id)
  }
  return slugToId
}

const upsertMethods = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  puzzleIds: Map<string, string>,
): Promise<Map<string, string>> => {
  const slugToId = new Map<string, string>()
  for (const m of bundle.methods) {
    const puzzleId = puzzleIds.get(m.puzzleSlug)
    if (!puzzleId) {
      throw new Error(`${m.filePath}: parent puzzle "${m.puzzleSlug}" not found in bundle`)
    }
    const row = await prisma.method.upsert({
      where: { puzzleId_slug: { puzzleId, slug: m.data.slug } },
      create: {
        puzzleId,
        slug: m.data.slug,
        name: m.data.name,
        displayOrder: m.data.display_order,
        descriptionMd: m.data.description_md ?? null,
      },
      update: {
        name: m.data.name,
        displayOrder: m.data.display_order,
        descriptionMd: m.data.description_md ?? null,
      },
      select: { id: true, slug: true },
    })
    slugToId.set(`${m.puzzleSlug}/${row.slug}`, row.id)
  }
  return slugToId
}

const upsertSets = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  methodIds: Map<string, string>,
): Promise<Map<string, string>> => {
  const slugToId = new Map<string, string>()
  for (const s of bundle.sets) {
    const methodId = methodIds.get(`${s.puzzleSlug}/${s.methodSlug}`)
    if (!methodId) {
      throw new Error(`${s.filePath}: parent method "${s.methodSlug}" not found in bundle`)
    }
    const row = await prisma.algorithmSet.upsert({
      where: { methodId_slug: { methodId, slug: s.data.slug } },
      create: {
        methodId,
        slug: s.data.slug,
        name: s.data.name,
        caseCountExpected: s.data.case_count_expected,
        recognitionBasis: s.data.recognition_basis,
        displayOrder: s.data.display_order,
      },
      update: {
        name: s.data.name,
        caseCountExpected: s.data.case_count_expected,
        recognitionBasis: s.data.recognition_basis,
        displayOrder: s.data.display_order,
      },
      select: { id: true, slug: true },
    })
    slugToId.set(`${s.puzzleSlug}/${s.methodSlug}/${row.slug}`, row.id)
  }
  return slugToId
}

const upsertCasesAndVariants = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  setIds: Map<string, string>,
): Promise<{ caseIds: Map<string, string>; variantsWritten: number }> => {
  const caseIds = new Map<string, string>()
  let variantsWritten = 0

  for (const c of bundle.cases) {
    const setId = setIds.get(`${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}`)
    if (!setId) {
      throw new Error(`${c.filePath}: parent set "${c.setSlug}" not found in bundle`)
    }

    const caseState = c.data.case_state.replace(/\s+/g, '')
    const tags = c.data.tags ?? []

    const row = await prisma.algorithmCase.upsert({
      where: { setId_slug: { setId, slug: c.data.slug } },
      create: {
        setId,
        slug: c.data.slug,
        name: c.data.name,
        displayName: c.data.display_name,
        displayOrder: c.data.display_order,
        caseState,
        recognitionMd: c.data.recognition_md ?? null,
        tags,
      },
      update: {
        name: c.data.name,
        displayName: c.data.display_name,
        displayOrder: c.data.display_order,
        caseState,
        recognitionMd: c.data.recognition_md ?? null,
        tags,
      },
      select: { id: true, slug: true },
    })
    caseIds.set(`${c.puzzleSlug}/${c.methodSlug}/${c.setSlug}/${row.slug}`, row.id)

    await prisma.algorithmVariant.deleteMany({ where: { caseId: row.id } })
    const created = await prisma.algorithmVariant.createMany({
      data: c.data.variants.map((v) => {
        const moves = parseAlgorithm(v.notation)
        return {
          caseId: row.id,
          notation: v.notation,
          moveCountHtm: htm(moves),
          moveCountStm: stm(moves),
          isPrimary: v.is_primary,
          attribution: v.attribution ?? null,
          fingertrickMd: v.fingertrick_md ?? null,
        }
      }),
    })
    variantsWritten += created.count
  }

  return { caseIds, variantsWritten }
}

const pruneOrphans = async (
  prisma: PrismaService,
  caseIds: Map<string, string>,
  setIds: Map<string, string>,
  methodIds: Map<string, string>,
  puzzleIds: Map<string, string>,
): Promise<{ cases: number; sets: number; methods: number; puzzles: number }> => {
  const presentCaseIds = new Set(caseIds.values())
  const presentSetIds = new Set(setIds.values())
  const presentMethodIds = new Set(methodIds.values())
  const presentPuzzleIds = new Set(puzzleIds.values())

  const allCases = await prisma.algorithmCase.findMany({ select: { id: true } })
  const orphanCases = allCases.filter((c) => !presentCaseIds.has(c.id)).map((c) => c.id)
  if (orphanCases.length > 0) {
    await prisma.algorithmCase.deleteMany({ where: { id: { in: orphanCases } } })
  }

  const allSets = await prisma.algorithmSet.findMany({ select: { id: true } })
  const orphanSets = allSets.filter((s) => !presentSetIds.has(s.id)).map((s) => s.id)
  if (orphanSets.length > 0) {
    await prisma.algorithmSet.deleteMany({ where: { id: { in: orphanSets } } })
  }

  const allMethods = await prisma.method.findMany({ select: { id: true } })
  const orphanMethods = allMethods.filter((m) => !presentMethodIds.has(m.id)).map((m) => m.id)
  if (orphanMethods.length > 0) {
    await prisma.method.deleteMany({ where: { id: { in: orphanMethods } } })
  }

  const allPuzzles = await prisma.puzzle.findMany({ select: { id: true } })
  const orphanPuzzles = allPuzzles.filter((p) => !presentPuzzleIds.has(p.id)).map((p) => p.id)
  if (orphanPuzzles.length > 0) {
    await prisma.puzzle.deleteMany({ where: { id: { in: orphanPuzzles } } })
  }

  return {
    cases: orphanCases.length,
    sets: orphanSets.length,
    methods: orphanMethods.length,
    puzzles: orphanPuzzles.length,
  }
}

export const upsertContent = async (
  prisma: PrismaService,
  bundle: ValidatedBundle,
  options: UpsertOptions,
): Promise<UpsertResult> => {
  const puzzleIds = await upsertPuzzles(prisma, bundle)
  const methodIds = await upsertMethods(prisma, bundle, puzzleIds)
  const setIds = await upsertSets(prisma, bundle, methodIds)
  const { caseIds, variantsWritten } = await upsertCasesAndVariants(prisma, bundle, setIds)

  let pruned = { cases: 0, sets: 0, methods: 0, puzzles: 0 }
  if (options.prune) {
    pruned = await pruneOrphans(prisma, caseIds, setIds, methodIds, puzzleIds)
  }

  return {
    puzzles: { upserted: puzzleIds.size, pruned: pruned.puzzles },
    methods: { upserted: methodIds.size, pruned: pruned.methods },
    sets: { upserted: setIds.size, pruned: pruned.sets },
    cases: { upserted: caseIds.size, pruned: pruned.cases },
    variants: { written: variantsWritten },
  }
}
