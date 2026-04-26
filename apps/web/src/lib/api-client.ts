import type { ZodType } from 'zod'

import { publicEnv, serverEnv } from './env'

export interface ApiError {
  status: number
  code?: string | undefined
  message: string
}

const isServer = typeof window === 'undefined'

const baseUrl = (): string => (isServer ? serverEnv.API_URL : publicEnv.NEXT_PUBLIC_API_URL)

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
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers })
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
