import 'server-only'

import { SearchResultSchema, type SearchResult } from '@rubik/shared'

import { apiFetch } from '@/lib/api-client'

const DEFAULT_LIMIT = 20

export const getSearchResults = (
  q: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchResult> =>
  apiFetch(
    `/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    SearchResultSchema,
  )
