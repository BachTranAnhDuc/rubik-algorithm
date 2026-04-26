import { z } from 'zod'

const publicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
})

const result = publicSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})

if (!result.success) {
  const issues = result.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n')
  throw new Error(`Invalid public env:\n${issues}`)
}

export const publicEnv = result.data
