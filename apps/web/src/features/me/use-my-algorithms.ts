'use client'

import { useQuery } from '@tanstack/react-query'
import { UserAlgorithmSchema, type UserAlgorithm } from '@rubik/shared'
import { useSession } from 'next-auth/react'
import { z } from 'zod'

import { publicEnv } from '@/lib/env.client'

import { meKeys } from './query-keys'

const STALE_TIME_MS = 5_000
const UserAlgorithmsSchema = z.array(UserAlgorithmSchema)

export const useMyAlgorithms = () => {
  const { data: session } = useSession()
  const token = session?.apiAccessToken
  return useQuery({
    queryKey: meKeys.algorithms,
    queryFn: async (): Promise<UserAlgorithm[]> => {
      if (!token) throw new Error('not authed')
      const res = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_URL}/v1/me/algorithms`,
        {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      )
      if (!res.ok) throw new Error(`/me/algorithms ${res.status}`)
      return UserAlgorithmsSchema.parse(await res.json())
    },
    enabled: !!token,
    staleTime: STALE_TIME_MS,
  })
}
