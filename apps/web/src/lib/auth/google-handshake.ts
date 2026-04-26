import 'server-only'

import { TokenPairSchema, type TokenPair } from '@rubik/shared'

import { apiFetch } from '../api-client'

export const googleHandshake = (idToken: string): Promise<TokenPair> =>
  apiFetch('/v1/auth/google', TokenPairSchema, {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
