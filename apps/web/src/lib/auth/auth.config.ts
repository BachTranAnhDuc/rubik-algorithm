import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

import { serverEnv } from '../env'
import { googleHandshake } from './google-handshake'

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
        } catch {
          return null
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
