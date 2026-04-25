import { z, type ZodTypeAny } from 'zod'

export const PaginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

export const paginatedResponseSchema = <T extends ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  })

export type PaginationParams = z.infer<typeof PaginationParamsSchema>
