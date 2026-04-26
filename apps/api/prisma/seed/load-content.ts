import { readdir, readFile, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'

import { load as parseYaml } from 'js-yaml'

export interface LoadedPuzzle {
  filePath: string
  data: Record<string, unknown>
}

export interface LoadedMethod {
  filePath: string
  puzzleSlug: string
  data: Record<string, unknown>
}

export interface LoadedSet {
  filePath: string
  puzzleSlug: string
  methodSlug: string
  data: Record<string, unknown>
}

export interface LoadedCase {
  filePath: string
  puzzleSlug: string
  methodSlug: string
  setSlug: string
  data: Record<string, unknown>
}

export interface ContentBundle {
  puzzles: LoadedPuzzle[]
  methods: LoadedMethod[]
  sets: LoadedSet[]
  cases: LoadedCase[]
}

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

const readYaml = async (filePath: string): Promise<Record<string, unknown>> => {
  const raw = await readFile(filePath, 'utf8')
  const parsed = parseYaml(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${filePath}: expected a YAML mapping at the document root`)
  }
  return parsed as Record<string, unknown>
}

const listSubdirs = async (path: string): Promise<string[]> => {
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

const listYamlFiles = async (path: string): Promise<string[]> => {
  if (!(await directoryExists(path))) return []
  const entries = await readdir(path, { withFileTypes: true })
  return entries.filter((e) => e.isFile() && e.name.endsWith('.yaml')).map((e) => e.name)
}

export const loadContent = async (rootDir: string): Promise<ContentBundle> => {
  if (!(await directoryExists(rootDir))) {
    throw new Error(`content directory does not exist: ${rootDir}`)
  }

  const bundle: ContentBundle = { puzzles: [], methods: [], sets: [], cases: [] }
  const puzzlesDir = join(rootDir, 'puzzles')
  if (!(await directoryExists(puzzlesDir))) return bundle

  for (const puzzleSlug of await listSubdirs(puzzlesDir)) {
    const puzzleRoot = join(puzzlesDir, puzzleSlug)
    const puzzleFile = join(puzzleRoot, 'puzzle.yaml')
    if (await directoryExists(puzzleRoot)) {
      try {
        const data = await readYaml(puzzleFile)
        bundle.puzzles.push({ filePath: puzzleFile, data })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }

    const methodsDir = join(puzzleRoot, 'methods')
    if (!(await directoryExists(methodsDir))) continue

    for (const methodSlug of await listSubdirs(methodsDir)) {
      const methodRoot = join(methodsDir, methodSlug)
      const methodFile = join(methodRoot, 'method.yaml')
      try {
        const data = await readYaml(methodFile)
        bundle.methods.push({ filePath: methodFile, puzzleSlug, data })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }

      const setsDir = join(methodRoot, 'sets')
      if (!(await directoryExists(setsDir))) continue

      for (const setSlug of await listSubdirs(setsDir)) {
        const setRoot = join(setsDir, setSlug)
        const setFile = join(setRoot, 'set.yaml')
        try {
          const data = await readYaml(setFile)
          bundle.sets.push({ filePath: setFile, puzzleSlug, methodSlug, data })
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }

        const casesDir = join(setRoot, 'cases')
        for (const caseFile of await listYamlFiles(casesDir)) {
          const filePath = join(casesDir, caseFile)
          const data = await readYaml(filePath)
          bundle.cases.push({ filePath, puzzleSlug, methodSlug, setSlug, data })
        }
      }
    }
  }

  return bundle
}

export const __forTest = { sep }
