import type { ZodType } from 'zod'

import { publicEnv } from './env.client'

export interface ApiError {
  status: number
  code?: string | undefined
  message: string
}

export const apiFetch = async <T>(
  path: string,
  schema: ZodType<T>,
  init?: RequestInit & { accessToken?: string },
): Promise<T> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.accessToken ? { authorization: `Bearer ${init.accessToken}` } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string }
    }
    const err: ApiError = {
      status: res.status,
      code: body?.error?.code,
      message: body?.error?.message ?? res.statusText,
    }
    throw err
  }
  return schema.parse(await res.json())
}
