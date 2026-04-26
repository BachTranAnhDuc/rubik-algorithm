import { PrismaClient } from '@prisma/client'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadContent } from './seed/load-content'
import { upsertContent } from './seed/upsert-content'
import { validateContent } from './seed/validate-content'

interface ParsedFlags {
  validateOnly: boolean
  dryRun: boolean
  prune: boolean
}

const parseFlags = (argv: string[]): ParsedFlags => ({
  validateOnly: argv.includes('--validate-only'),
  dryRun: argv.includes('--dry-run'),
  prune: argv.includes('--prune'),
})

const resolveContentRoot = (): string => {
  const here = fileURLToPath(new URL('.', import.meta.url))
  return resolve(here, '..', '..', '..', 'content')
}

const main = async () => {
  const flags = parseFlags(process.argv.slice(2))
  const contentRoot = resolveContentRoot()

  console.log(`[seed] reading from ${contentRoot}`)
  const bundle = await loadContent(contentRoot)
  console.log(
    `[seed] loaded ${bundle.puzzles.length} puzzles, ${bundle.methods.length} methods, ${bundle.sets.length} sets, ${bundle.cases.length} cases`,
  )

  const validated = validateContent(bundle)
  console.log(`[seed] validated all content (zod + cube-core cross-check)`)

  if (flags.validateOnly) {
    console.log(`[seed] --validate-only set; not writing to DB`)
    return
  }

  if (flags.dryRun) {
    console.log(
      `[seed] --dry-run set; would upsert ${validated.puzzles.length}+${validated.methods.length}+${validated.sets.length}+${validated.cases.length} rows; not writing`,
    )
    return
  }

  const prisma = new PrismaClient()
  try {
    const result = await upsertContent(prisma, validated, { prune: flags.prune })
    console.log(`[seed] ${JSON.stringify(result)}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
