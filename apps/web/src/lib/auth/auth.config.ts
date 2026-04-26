import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

import { serverEnv } from '../env.server'
import { googleHandshake } from './google-handshake'
import { refreshApiTokens } from './refresh'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: serverEnv.AUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: serverEnv.AUTH_GOOGLE_ID,
      clientSecret: serverEnv.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn: ({ account }) => {
      if (account?.provider !== 'google') return false
      if (!account.id_token) return false
      return true
    },
    jwt: async ({ token, account }) => {
      if (account?.provider === 'google' && account.id_token) {
        try {
          const pair = await googleHandshake(account.id_token)
          token.apiAccessToken = pair.accessToken
          token.apiRefreshToken = pair.refreshToken
          token.apiExpiresAt = Date.now() + pair.expiresIn * 1000
          return token
        } catch {
          return null
        }
      }
      if (token.apiAccessToken && token.apiRefreshToken && token.apiExpiresAt) {
        const SKEW_MS = 60_000
        if (token.apiExpiresAt - Date.now() < SKEW_MS) {
          try {
            const pair = await refreshApiTokens(token.apiRefreshToken)
            token.apiAccessToken = pair.accessToken
            token.apiRefreshToken = pair.refreshToken
            token.apiExpiresAt = Date.now() + pair.expiresIn * 1000
          } catch {
            return null
          }
        }
      }
      return token
    },
    session: ({ session, token }) => {
      if (token) {
        session.apiAccessToken = token.apiAccessToken
        session.apiRefreshToken = token.apiRefreshToken
        session.apiExpiresAt = token.apiExpiresAt
      }
      return session
    },
  },
})
