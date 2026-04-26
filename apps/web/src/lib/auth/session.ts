import 'server-only'

import { UserSchema, type User } from '@rubik/shared'

import { apiFetch } from '../api-client'
import { auth } from './auth.config'

export const getCurrentUser = async (): Promise<User | null> => {
  const session = await auth()
  if (!session?.apiAccessToken) return null
  try {
    return await apiFetch('/v1/me', UserSchema, { accessToken: session.apiAccessToken })
  } catch {
    return null
  }
}
