'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserAlgorithmSchema,
  type LearningStatus,
  type UserAlgorithm,
} from '@rubik/shared'
import { useSession } from 'next-auth/react'

import { publicEnv } from '@/lib/env.client'

import { meKeys } from './query-keys'

interface UpdateInput {
  caseId: string
  caseSlug: string
  status: LearningStatus
}

interface OptimisticContext {
  prev: UserAlgorithm[] | undefined
}

export const useUpdateAlgorithm = () => {
  const { data: session } = useSession()
  const token = session?.apiAccessToken
  const qc = useQueryClient()

  return useMutation<UserAlgorithm, Error, UpdateInput, OptimisticContext>({
    mutationFn: async (input) => {
      if (!token) throw new Error('not authed')
      const res = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_URL}/v1/me/algorithms/${input.caseSlug}`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: input.status }),
          cache: 'no-store',
        },
      )
      if (!res.ok) throw new Error(`PUT /me/algorithms ${res.status}`)
      return UserAlgorithmSchema.parse(await res.json())
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: meKeys.algorithms })
      const prev = qc.getQueryData<UserAlgorithm[]>(meKeys.algorithms)
      qc.setQueryData<UserAlgorithm[]>(meKeys.algorithms, (old = []) => {
        const idx = old.findIndex((u) => u.caseId === input.caseId)
        const now = new Date().toISOString()
        if (idx >= 0) {
          const next = old.slice()
          next[idx] = { ...old[idx]!, status: input.status, updatedAt: now }
          return next
        }
        return [
          ...old,
          {
            caseId: input.caseId,
            chosenVariantId: null,
            status: input.status,
            personalNotesMd: null,
            updatedAt: now,
          },
        ]
      })
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(meKeys.algorithms, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: meKeys.algorithms })
    },
  })
}
