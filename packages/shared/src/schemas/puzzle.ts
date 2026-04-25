import { z } from 'zod'

import { RECOGNITION_BASES } from '../constants/recognition-bases'
import { SlugSchema } from '../utils/slug'

export const RecognitionBasisSchema = z.enum(RECOGNITION_BASES)

export const PuzzleSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  name: z.string().min(1),
  wcaEventCode: z.string().nullable(),
  displayOrder: z.number().int().nonnegative(),
})

export const MethodSchema = z.object({
  id: z.string(),
  puzzleId: z.string(),
  slug: SlugSchema,
  name: z.string().min(1),
  descriptionMd: z.string().nullable(),
  displayOrder: z.number().int().nonnegative(),
})

export const AlgorithmVariantSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  notation: z.string().min(1),
  moveCountHtm: z.number().int().nonnegative(),
  moveCountStm: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  attribution: z.string().nullable(),
  fingertrickMd: z.string().nullable(),
  displayOrder: z.number().int().nonnegative(),
})

export const AlgorithmCaseSchema = z.object({
  id: z.string(),
  setId: z.string(),
  slug: SlugSchema,
  name: z.string().min(1),
  displayName: z.string().min(1),
  displayOrder: z.number().int().nonnegative(),
  caseState: z.string().min(1),
  recognitionMd: z.string().nullable(),
  tags: z.array(SlugSchema),
})

export const AlgorithmCaseWithVariantsSchema = AlgorithmCaseSchema.extend({
  variants: z.array(AlgorithmVariantSchema),
})

export const AlgorithmSetSchema = z.object({
  id: z.string(),
  methodId: z.string(),
  slug: SlugSchema,
  name: z.string().min(1),
  caseCountExpected: z.number().int().nonnegative(),
  recognitionBasis: RecognitionBasisSchema,
  displayOrder: z.number().int().nonnegative(),
})

export const AlgorithmSetWithCasesSchema = AlgorithmSetSchema.extend({
  cases: z.array(AlgorithmCaseWithVariantsSchema),
})

export type RecognitionBasis = z.infer<typeof RecognitionBasisSchema>
export type Puzzle = z.infer<typeof PuzzleSchema>
export type Method = z.infer<typeof MethodSchema>
export type AlgorithmSet = z.infer<typeof AlgorithmSetSchema>
export type AlgorithmCase = z.infer<typeof AlgorithmCaseSchema>
export type AlgorithmCaseWithVariants = z.infer<typeof AlgorithmCaseWithVariantsSchema>
export type AlgorithmVariant = z.infer<typeof AlgorithmVariantSchema>
export type AlgorithmSetWithCases = z.infer<typeof AlgorithmSetWithCasesSchema>
