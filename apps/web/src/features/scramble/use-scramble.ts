'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrambleResultSchema, type ScrambleResult } from '@rubik/shared'

import { publicEnv } from '@/lib/env.client'

import { scrambleKeys } from './query-keys'

export type ScrambleMode = { kind: 'random' } | { kind: 'case'; slug: string }

const fetchScramble = async (mode: ScrambleMode): Promise<ScrambleResult> => {
  const url =
    mode.kind === 'random'
      ? `${publicEnv.NEXT_PUBLIC_API_URL}/v1/scramble?puzzle=3x3`
      : `${publicEnv.NEXT_PUBLIC_API_URL}/v1/scramble/case/${encodeURIComponent(mode.slug)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`scramble fetch failed: ${res.status}`)
  }
  return ScrambleResultSchema.parse(await res.json())
}

const queryKeyFor = (mode: ScrambleMode) =>
  mode.kind === 'random' ? scrambleKeys.random() : scrambleKeys.forCase(mode.slug)

export const useScramble = (mode: ScrambleMode) => {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: queryKeyFor(mode),
    queryFn: () => fetchScramble(mode),
    staleTime: 0,
  })
  const refetchNext = () => {
    qc.invalidateQueries({ queryKey: queryKeyFor(mode) })
  }
  return { ...query, refetchNext }
}
