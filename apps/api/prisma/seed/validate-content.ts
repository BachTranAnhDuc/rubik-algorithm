import {
  applyAlgorithm,
  fromStickerString,
  parseAlgorithm,
  SOLVED_STATE,
  stateEquals,
} from '@rubik/cube-core'
import {
  CaseContentSchema,
  type CaseContent,
  MethodContentSchema,
  type MethodContent,
  PuzzleContentSchema,
  type PuzzleContent,
  SetContentSchema,
  type SetContent,
} from '@rubik/shared/content'
import type { ZodIssue, ZodTypeAny, z } from 'zod'

import type {
  ContentBundle,
  LoadedCase,
  LoadedMethod,
  LoadedPuzzle,
  LoadedSet,
} from './load-content'

export interface ValidatedPuzzle extends Omit<LoadedPuzzle, 'data'> {
  data: PuzzleContent
}
export interface ValidatedMethod extends Omit<LoadedMethod, 'data'> {
  data: MethodContent
}
export interface ValidatedSet extends Omit<LoadedSet, 'data'> {
  data: SetContent
}
export interface ValidatedCase extends Omit<LoadedCase, 'data'> {
  data: CaseContent
}

export interface ValidatedBundle {
  puzzles: ValidatedPuzzle[]
  methods: ValidatedMethod[]
  sets: ValidatedSet[]
  cases: ValidatedCase[]
}

const formatZodIssues = (filePath: string, issues: ZodIssue[]): string => {
  const lines = issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  return `${filePath}:\n${lines.join('\n')}`
}

const parseOrThrow = <S extends ZodTypeAny>(
  schema: S,
  filePath: string,
  data: unknown,
): z.infer<S> => {
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(formatZodIssues(filePath, result.error.issues))
  return result.data
}

const crossCheckCase = (filePath: string, c: CaseContent): void => {
  const primary = c.variants.find((v) => v.is_primary)
  if (!primary) {
    throw new Error(`${filePath}: case has no is_primary variant (schema should have caught this)`)
  }
  const initialState = fromStickerString(c.case_state)
  const moves = parseAlgorithm(primary.notation)
  const finalState = applyAlgorithm(initialState, moves)
  if (!stateEquals(finalState, SOLVED_STATE)) {
    throw new Error(
      `${filePath}: primary notation does not solve case_state (case=${c.slug}, alg="${primary.notation}")`,
    )
  }
}

export const validateContent = (bundle: ContentBundle): ValidatedBundle => {
  const validated: ValidatedBundle = { puzzles: [], methods: [], sets: [], cases: [] }

  for (const p of bundle.puzzles) {
    const data = parseOrThrow(PuzzleContentSchema, p.filePath, p.data)
    validated.puzzles.push({ filePath: p.filePath, data })
  }
  for (const m of bundle.methods) {
    const data = parseOrThrow(MethodContentSchema, m.filePath, m.data)
    validated.methods.push({ filePath: m.filePath, puzzleSlug: m.puzzleSlug, data })
  }
  for (const s of bundle.sets) {
    const data = parseOrThrow(SetContentSchema, s.filePath, s.data)
    validated.sets.push({
      filePath: s.filePath,
      puzzleSlug: s.puzzleSlug,
      methodSlug: s.methodSlug,
      data,
    })
  }
  for (const c of bundle.cases) {
    const data = parseOrThrow(CaseContentSchema, c.filePath, c.data)
    crossCheckCase(c.filePath, data)
    validated.cases.push({
      filePath: c.filePath,
      puzzleSlug: c.puzzleSlug,
      methodSlug: c.methodSlug,
      setSlug: c.setSlug,
      data,
    })
  }

  return validated
}
