import { z } from 'zod'

import { RECOGNITION_BASES } from '../constants/recognition-bases'
import { SlugSchema } from '../utils/slug'

const CASE_STATE_LENGTH = 54

// Note: display_name on Puzzle/AlgorithmSet and description_md on AlgorithmSet are deferred
// until the API surface needs them. Today the Prisma schema and the @rubik/shared API DTOs
// don't carry these fields, so accepting them here would be silent data loss on seed.
// Re-add when (a) the columns land via migration AND (b) the API returns them.
export const PuzzleContentSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  wca_event_code: z.string().nullable().optional(),
  display_order: z.number().int().nonnegative(),
  state_schema_version: z.string().default('v1'),
})

export const MethodContentSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  display_order: z.number().int().nonnegative(),
  description_md: z.string().nullable().optional(),
})

export const SetContentSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  case_count_expected: z.number().int().nonnegative(),
  recognition_basis: z.enum(RECOGNITION_BASES),
  display_order: z.number().int().nonnegative(),
})

export const VariantContentSchema = z.object({
  notation: z.string().min(1),
  is_primary: z.boolean().default(false),
  attribution: z.string().nullable().optional(),
  fingertrick_md: z.string().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
})

export const CaseContentSchema = z
  .object({
    slug: SlugSchema,
    name: z.string().min(1),
    display_name: z.string().min(1),
    display_order: z.number().int().nonnegative(),
    case_state: z.string().refine(
      (s) => s.replace(/\s+/g, '').length === CASE_STATE_LENGTH,
      `case_state must be exactly ${CASE_STATE_LENGTH} characters (whitespace ignored)`,
    ),
    recognition_md: z.string().nullable().optional(),
    tags: z.array(SlugSchema).default([]),
    variants: z.array(VariantContentSchema).min(1, 'must have at least one variant'),
  })
  .refine(
    (data) => data.variants.filter((v) => v.is_primary).length === 1,
    'exactly one variant must be is_primary',
  )

export type PuzzleContent = z.infer<typeof PuzzleContentSchema>
export type MethodContent = z.infer<typeof MethodContentSchema>
export type SetContent = z.infer<typeof SetContentSchema>
export type VariantContent = z.infer<typeof VariantContentSchema>
export type CaseContent = z.infer<typeof CaseContentSchema>
