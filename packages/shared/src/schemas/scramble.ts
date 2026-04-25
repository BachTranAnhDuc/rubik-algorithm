import { z } from 'zod'

import { PUZZLE_SLUGS } from '../constants/puzzles'

export const ScrambleQuerySchema = z.object({
  puzzle: z.enum(PUZZLE_SLUGS).default('3x3'),
  seed: z.string().optional(),
})

export const ScrambleResultSchema = z.object({
  puzzle: z.enum(PUZZLE_SLUGS),
  scramble: z.string().min(1),
  seed: z.string().nullable(),
})

export const CaseScrambleQuerySchema = z.object({
  caseId: z.string(),
  seed: z.string().optional(),
})

export type ScrambleQuery = z.infer<typeof ScrambleQuerySchema>
export type ScrambleResult = z.infer<typeof ScrambleResultSchema>
export type CaseScrambleQuery = z.infer<typeof CaseScrambleQuerySchema>
