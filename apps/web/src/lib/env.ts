import { z } from 'zod'

const serverSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  API_URL: z.string().url(),
})

const publicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
})

const isServer = typeof window === 'undefined'

const parseServerEnv = () => {
  const result = serverSchema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    API_URL: process.env.API_URL,
  })
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid server env:\n${issues}`)
  }
  return result.data
}

const parsePublicEnv = () => {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  })
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid public env:\n${issues}`)
  }
  return result.data
}

// Server env is only safe to read on the server. We use a getter so client-side
// code that accidentally imports this never reads server vars.
export const serverEnv = isServer ? parseServerEnv() : ({} as ReturnType<typeof parseServerEnv>)
export const publicEnv = parsePublicEnv()
