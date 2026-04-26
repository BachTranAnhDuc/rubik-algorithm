import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    apiAccessToken?: string | undefined
    apiRefreshToken?: string | undefined
    apiExpiresAt?: number | undefined
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    apiAccessToken?: string | undefined
    apiRefreshToken?: string | undefined
    apiExpiresAt?: number | undefined
  }
}
