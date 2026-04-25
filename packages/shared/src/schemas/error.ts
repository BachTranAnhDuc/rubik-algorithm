import { z } from 'zod'

export const ErrorCodeSchema = z.enum([
  'validation_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'internal',
])

export const ErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
  requestId: z.string().optional(),
})

export type ErrorCode = z.infer<typeof ErrorCodeSchema>
export type ErrorBody = z.infer<typeof ErrorBodySchema>
