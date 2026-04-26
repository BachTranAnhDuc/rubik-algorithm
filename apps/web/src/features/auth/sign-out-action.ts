'use server'

import { auth, signOut as authSignOut } from '@/lib/auth/auth.config'
import { publicEnv } from '@/lib/env.client'

export const serverSignOut = async (): Promise<void> => {
  const session = await auth()
  if (session?.apiRefreshToken) {
    try {
      await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.apiRefreshToken }),
        cache: 'no-store',
      })
    } catch {
      // best-effort — any failure (network, config) is safe to swallow;
      // signOut below clears the Auth.js session regardless.
    }
  }
  await authSignOut({ redirectTo: '/' })
}
