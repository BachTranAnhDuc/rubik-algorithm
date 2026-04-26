import 'server-only'

import {
  AlgorithmCaseWithVariantsSchema,
  AlgorithmSetSchema,
  AlgorithmSetWithCasesSchema,
  MethodSchema,
  PuzzleSchema,
  type AlgorithmCase,
  type AlgorithmCaseWithVariants,
  type AlgorithmSet,
  type AlgorithmSetWithCases,
  type Method,
  type Puzzle,
} from '@rubik/shared'
import { z } from 'zod'

import { apiFetch } from '@/lib/api-client'

export const getPuzzles = (): Promise<Puzzle[]> =>
  apiFetch('/v1/puzzles', z.array(PuzzleSchema))

export const getMethods = (puzzleSlug: string): Promise<Method[]> =>
  apiFetch(`/v1/puzzles/${puzzleSlug}/methods`, z.array(MethodSchema))

export const getSets = (
  puzzleSlug: string,
  methodSlug: string,
): Promise<AlgorithmSet[]> =>
  apiFetch(
    `/v1/puzzles/${puzzleSlug}/methods/${methodSlug}/sets`,
    z.array(AlgorithmSetSchema),
  )

export const getSetWithCases = (setSlug: string): Promise<AlgorithmSetWithCases> =>
  apiFetch(`/v1/sets/${setSlug}`, AlgorithmSetWithCasesSchema)

export const getCaseWithVariants = (
  caseSlug: string,
): Promise<AlgorithmCaseWithVariants> =>
  apiFetch(`/v1/cases/${caseSlug}`, AlgorithmCaseWithVariantsSchema)

export interface CaseLocation {
  case: AlgorithmCase
  setSlug: string
  methodSlug: string
  puzzleSlug: string
}

export const getAllCases = async (): Promise<CaseLocation[]> => {
  const puzzles = await getPuzzles()
  const perPuzzle = await Promise.all(
    puzzles.map(async (p) => {
      const methods = await getMethods(p.slug)
      const perMethod = await Promise.all(
        methods.map(async (m) => {
          const sets = await getSets(p.slug, m.slug)
          const perSet = await Promise.all(
            sets.map(async (s) => {
              const setData = await getSetWithCases(s.slug)
              return setData.cases.map(
                (c): CaseLocation => ({
                  case: c,
                  setSlug: s.slug,
                  methodSlug: m.slug,
                  puzzleSlug: p.slug,
                }),
              )
            }),
          )
          return perSet.flat()
        }),
      )
      return perMethod.flat()
    }),
  )
  return perPuzzle.flat()
}
