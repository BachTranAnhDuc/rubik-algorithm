import { z } from 'zod'

export const GoogleLoginSchema = z.object({
  idToken: z.string().min(1),
})

export const TokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
})

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
})

export type GoogleLogin = z.infer<typeof GoogleLoginSchema>
export type TokenPair = z.infer<typeof TokenPairSchema>
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>
