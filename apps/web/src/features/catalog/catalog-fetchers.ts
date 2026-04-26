import 'server-only'

import {
  AlgorithmCaseWithVariantsSchema,
  AlgorithmSetSchema,
  AlgorithmSetWithCasesSchema,
  MethodSchema,
  PuzzleSchema,
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
