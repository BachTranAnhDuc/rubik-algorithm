import { z } from 'zod'

import { LEARNING_STATUSES } from '../constants/learning-status'

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
})

export const LearningStatusSchema = z.enum(LEARNING_STATUSES)

export const UserAlgorithmSchema = z.object({
  caseId: z.string(),
  chosenVariantId: z.string().nullable(),
  status: LearningStatusSchema,
  personalNotesMd: z.string().nullable(),
  updatedAt: z.string().datetime(),
})

export const UpdateUserAlgorithmSchema = z.object({
  status: LearningStatusSchema.optional(),
  chosenVariantId: z.string().nullable().optional(),
  personalNotesMd: z.string().nullable().optional(),
})

export type User = z.infer<typeof UserSchema>
export type LearningStatus = z.infer<typeof LearningStatusSchema>
export type UserAlgorithm = z.infer<typeof UserAlgorithmSchema>
export type UpdateUserAlgorithm = z.infer<typeof UpdateUserAlgorithmSchema>
