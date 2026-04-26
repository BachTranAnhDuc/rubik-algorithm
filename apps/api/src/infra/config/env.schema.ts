import { z } from 'zod'

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),

    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    REDIS_URL: z.string().url(),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),

    GOOGLE_CLIENT_ID: z.string().optional(),

    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    SENTRY_DSN: z.string().url().optional(),

    CORS_ORIGINS: z.string().optional(),
  })
  .refine((env) => env.NODE_ENV === 'test' || (env.GOOGLE_CLIENT_ID?.length ?? 0) > 0, {
    message: 'GOOGLE_CLIENT_ID is required when NODE_ENV is not "test"',
    path: ['GOOGLE_CLIENT_ID'],
  })

export type Env = z.infer<typeof envSchema>

export const parseEnv = (raw: NodeJS.ProcessEnv): Env => {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return result.data
}
