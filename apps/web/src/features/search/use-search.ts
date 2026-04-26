'use client'

import { useQuery } from '@tanstack/react-query'
import { SearchResultSchema, type SearchResult } from '@rubik/shared'

import { publicEnv } from '@/lib/env.client'

import { searchKeys } from './query-keys'

const STALE_TIME_MS = 30_000

const fetchSearch = async (q: string, limit: number): Promise<SearchResult> => {
  const url = `${publicEnv.NEXT_PUBLIC_API_URL}/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`)
  }
  return SearchResultSchema.parse(await res.json())
}

export const useSearch = (q: string, limit = 10) =>
  useQuery({
    queryKey: searchKeys.query(q, limit),
    queryFn: () => fetchSearch(q, limit),
    enabled: q.trim().length > 0,
    staleTime: STALE_TIME_MS,
  })
