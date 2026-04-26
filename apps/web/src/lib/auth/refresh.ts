import 'server-only'

import { TokenPairSchema, type TokenPair } from '@rubik/shared'

import { publicEnv } from '../env.client'

export const refreshApiTokens = async (refreshToken: string): Promise<TokenPair> => {
  const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`refresh failed: ${res.status}`)
  }
  return TokenPairSchema.parse(await res.json())
}
