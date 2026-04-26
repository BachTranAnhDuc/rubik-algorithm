'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type UserAlgorithm } from '@rubik/shared'
import { useSession } from 'next-auth/react'

import { publicEnv } from '@/lib/env.client'

import { meKeys } from './query-keys'

interface DeleteInput {
  caseId: string
  caseSlug: string
}

interface OptimisticContext {
  prev: UserAlgorithm[] | undefined
}

export const useDeleteAlgorithm = () => {
  const { data: session } = useSession()
  const token = session?.apiAccessToken
  const qc = useQueryClient()

  return useMutation<void, Error, DeleteInput, OptimisticContext>({
    mutationFn: async (input) => {
      if (!token) throw new Error('not authed')
      const res = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_URL}/v1/me/algorithms/${input.caseSlug}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      )
      if (!res.ok && res.status !== 204) {
        throw new Error(`DELETE /me/algorithms ${res.status}`)
      }
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: meKeys.algorithms })
      const prev = qc.getQueryData<UserAlgorithm[]>(meKeys.algorithms)
      qc.setQueryData<UserAlgorithm[]>(meKeys.algorithms, (old = []) =>
        old.filter((u) => u.caseId !== input.caseId),
      )
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
