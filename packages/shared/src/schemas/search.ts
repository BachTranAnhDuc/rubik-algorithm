import { z } from 'zod'

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const SearchHitSchema = z.object({
  caseId: z.string(),
  caseSlug: z.string(),
  caseName: z.string(),
  setSlug: z.string(),
  methodSlug: z.string(),
  puzzleSlug: z.string(),
  matchHighlight: z.string().nullable(),
  rank: z.number(),
})

export const SearchResultSchema = z.object({
  query: z.string(),
  hits: z.array(SearchHitSchema),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>
export type SearchHit = z.infer<typeof SearchHitSchema>
export type SearchResult = z.infer<typeof SearchResultSchema>
