# Plan 05 sub-phase 4 — Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `auth`, `users`, and `me` modules over the §21 schema; wire `JwtAuthGuard` as global `APP_GUARD`; close the auth round-trip (Google ID token → app JWT pair → authenticated `/v1/me`).

**Architecture:** Three NestJS modules under `apps/api/src/modules/`. `AuthModule` owns the Google verifier, JWT issue/rotate/revoke, and the passport-jwt strategy. `UsersModule` owns Prisma access for `User`. `MeModule` owns `/v1/me` and `/v1/me/algorithms/*`, depending on `UsersModule`. `JwtAuthGuard` (already in `common/guards/`) registers as `APP_GUARD` in `app.module.ts`; `@Public()` lands on health and auth handlers. Tokens flow as JSON body — the api stays cookieless. Refresh tokens are SHA-256-hashed before persisting; refresh rotation is simple (replayed-revoked → 401).

**Tech Stack:** NestJS 11, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `google-auth-library`, Prisma 6, `nestjs-prisma`, `nestjs-zod`, Vitest, `unplugin-swc` (for decorator metadata in tests).

**Spec:** [`docs/plans/2026-04-25-api-sub-phase-4-design.md`](2026-04-25-api-sub-phase-4-design.md) (commit `b37acb6`)
**Schema source of truth:** §21.2 of [`docs/plans/2026-04-25-rubik-platform-mvp-design.md`](2026-04-25-rubik-platform-mvp-design.md) (User, UserAlgorithm, RefreshToken)
**API surface:** §5.1 of the same master design.

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline -3`

Expected: branch `docs/cubing-domain-research`; latest commit is `b37acb6 docs(plans): add api sub-phase 4 design`.

- [ ] **Step 2: Confirm Compose Postgres is up (Postgres on 5433, Redis on 6379)**

Run: `docker compose -f /home/ducbach/Documents/study/rubik-algorithm/docker-compose.yaml ps`

Expected: postgres + redis both `running` and `healthy`. If not: `make services.up` from the repo root.

- [ ] **Step 3: Confirm api unit tests pass at HEAD before any changes**

Run: `pnpm --filter @rubik/api test`

Expected: all sub-phase 3 specs green (PuzzlesService, MethodsService, SetsService, CasesService = 5 specs total).

---

## Task 1: Tighten env schema and add CurrentUser decorator

**Files:**
- Modify: `apps/api/src/infra/config/env.schema.ts`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/types/authed-request.ts`

`GOOGLE_CLIENT_ID` is currently optional in the env schema. Auth requires it at runtime. Tighten to required when `NODE_ENV !== 'test'` so dev/prod fail fast and tests can omit it. `CurrentUser` decorator gives controllers a typed shortcut to `req.user` so handlers don't read `req.user` directly (per §030-nestjs-rule.md).

- [ ] **Step 1.1: Edit `apps/api/src/infra/config/env.schema.ts`**

Replace the file with:

```ts
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
```

- [ ] **Step 1.2: Create `apps/api/src/common/types/authed-request.ts`**

```ts
import type { Request } from 'express'

export interface AuthedUser {
  id: string
  email: string
}

export interface AuthedRequest extends Request {
  user: AuthedUser
}
```

- [ ] **Step 1.3: Create `apps/api/src/common/decorators/current-user.decorator.ts`**

```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthedRequest, AuthedUser } from '../types/authed-request'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>()
    return request.user
  },
)
```

- [ ] **Step 1.4: Typecheck passes**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/src/infra/config/env.schema.ts apps/api/src/common/types/authed-request.ts apps/api/src/common/decorators/current-user.decorator.ts
git commit -m "$(cat <<'EOF'
feat(api): require GOOGLE_CLIENT_ID outside test + add CurrentUser decorator

Refines env schema so dev/prod startup fails fast when GOOGLE_CLIENT_ID
is missing; tests can omit it because GoogleVerifierService is mocked
at the seam. CurrentUser decorator + AuthedRequest type prepare for the
JwtAuthGuard wire-up later in sub-phase 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Users module — `UsersService.upsertFromGoogle` and `findById`

**Files:**
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.module.ts`
- Create: `apps/api/src/modules/users/__tests__/users.service.spec.ts`

`UsersService` is a thin wrapper around `prisma.user`. `upsertFromGoogle` is the only domain method; `findById` is a passthrough for `MeService` and `AuthService.rotate` to consume.

- [ ] **Step 2.1: Write the failing service spec**

Create `apps/api/src/modules/users/__tests__/users.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersService } from '../users.service'

const buildPrismaMock = () => ({
  user: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(UsersService)
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('upsertFromGoogle', () => {
    it('creates a new user when googleSub is unknown', async () => {
      prisma.user.upsert.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        googleSub: 'g-1',
        displayName: 'Ana',
        avatarUrl: null,
      })
      const service = await compileModule(prisma)

      const user = await service.upsertFromGoogle({
        googleSub: 'g-1',
        email: 'a@b.com',
        displayName: 'Ana',
        avatarUrl: null,
      })

      expect(user.id).toBe('u1')
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { googleSub: 'g-1' },
          create: expect.objectContaining({ googleSub: 'g-1', email: 'a@b.com', displayName: 'Ana' }),
          update: expect.objectContaining({
            email: 'a@b.com',
            displayName: 'Ana',
            avatarUrl: null,
            lastLoginAt: expect.any(Date),
          }),
        }),
      )
    })

    it('updates lastLoginAt and profile fields on a returning user', async () => {
      prisma.user.upsert.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        googleSub: 'g-1',
        displayName: 'Ana Updated',
        avatarUrl: 'https://x/y.png',
      })
      const service = await compileModule(prisma)

      await service.upsertFromGoogle({
        googleSub: 'g-1',
        email: 'a@b.com',
        displayName: 'Ana Updated',
        avatarUrl: 'https://x/y.png',
      })

      const call = prisma.user.upsert.mock.calls[0][0]
      expect(call.update.lastLoginAt).toBeInstanceOf(Date)
    })
  })

  describe('findById', () => {
    it('returns the user when it exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      const service = await compileModule(prisma)

      const user = await service.findById('u1')

      expect(user).toEqual({ id: 'u1', email: 'a@b.com' })
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } })
    })

    it('returns null when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma)

      expect(await service.findById('missing')).toBeNull()
    })
  })
})
```

- [ ] **Step 2.2: Run the spec to verify it fails (no `UsersService` yet)**

Run: `pnpm --filter @rubik/api test src/modules/users`

Expected: FAIL with "Cannot find module '../users.service'".

- [ ] **Step 2.3: Create `apps/api/src/modules/users/users.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import type { User } from '@prisma/client'
import { PrismaService } from 'nestjs-prisma'

interface UpsertFromGoogleInput {
  googleSub: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromGoogle(input: UpsertFromGoogleInput): Promise<User> {
    const now = new Date()
    return this.prisma.user.upsert({
      where: { googleSub: input.googleSub },
      create: {
        googleSub: input.googleSub,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastLoginAt: now,
      },
      update: {
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastLoginAt: now,
      },
    })
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }
}
```

- [ ] **Step 2.4: Create `apps/api/src/modules/users/users.module.ts`**

```ts
import { Module } from '@nestjs/common'

import { UsersService } from './users.service'

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 2.5: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/users`

Expected: PASS — 4 tests.

- [ ] **Step 2.6: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 2.7: Commit**

```bash
git add apps/api/src/modules/users/
git commit -m "$(cat <<'EOF'
feat(api): add users module with upsertFromGoogle and findById

UsersService wraps prisma.user.upsert for the Google-login path and
provides findById for AuthService.rotate and MeService to consume.
Sets lastLoginAt = now on every upsert (create or update).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Auth exceptions + Google verifier service

**Files:**
- Create: `apps/api/src/modules/auth/exceptions.ts`
- Create: `apps/api/src/modules/auth/google/google-verifier.service.ts`
- Create: `apps/api/src/modules/auth/google/__tests__/google-verifier.service.spec.ts`

Auth's three exception classes (`InvalidGoogleToken`, `InvalidRefreshToken`, `RefreshExpired`) all extend `HttpException` with stable string codes per §030 + §090. `GoogleVerifierService` wraps `google-auth-library`'s `OAuth2Client.verifyIdToken` — it's the seam every auth test mocks.

- [ ] **Step 3.1: Create `apps/api/src/modules/auth/exceptions.ts`**

```ts
import { HttpException, HttpStatus } from '@nestjs/common'

const buildPayload = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : {}),
})

export class InvalidGoogleTokenException extends HttpException {
  constructor(reason?: string) {
    super(
      buildPayload(
        'invalid_google_token',
        'Google ID token failed verification',
        reason ? { reason } : undefined,
      ),
      HttpStatus.UNAUTHORIZED,
    )
  }
}

export class InvalidRefreshTokenException extends HttpException {
  constructor() {
    super(
      buildPayload('invalid_refresh_token', 'Refresh token is invalid or revoked'),
      HttpStatus.UNAUTHORIZED,
    )
  }
}

export class RefreshExpiredException extends HttpException {
  constructor() {
    super(
      buildPayload('refresh_expired', 'Refresh token has expired'),
      HttpStatus.UNAUTHORIZED,
    )
  }
}
```

- [ ] **Step 3.2: Write the failing google-verifier spec**

Create `apps/api/src/modules/auth/google/__tests__/google-verifier.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { OAuth2Client } from 'google-auth-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigService } from '../../../../infra/config/config.service'
import { InvalidGoogleTokenException } from '../../exceptions'
import { GoogleVerifierService } from '../google-verifier.service'

const verifyIdToken = vi.fn()
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
}))

const buildConfigMock = () => ({
  get: vi.fn((key: string) => {
    if (key === 'GOOGLE_CLIENT_ID') return 'client-id'
    return undefined
  }),
})

const compileModule = async () => {
  const config = buildConfigMock()
  const moduleRef = await Test.createTestingModule({
    providers: [GoogleVerifierService, { provide: ConfigService, useValue: config }],
  }).compile()
  return moduleRef.get(GoogleVerifierService)
}

describe('GoogleVerifierService', () => {
  beforeEach(() => {
    verifyIdToken.mockReset()
    ;(OAuth2Client as unknown as ReturnType<typeof vi.fn>).mockClear()
  })

  it('returns sub/email/name/picture from a valid id token', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'g-1',
        email: 'a@b.com',
        name: 'Ana',
        picture: 'https://x/y.png',
      }),
    })
    const service = await compileModule()

    const profile = await service.verify('id-token')

    expect(profile).toEqual({
      sub: 'g-1',
      email: 'a@b.com',
      name: 'Ana',
      picture: 'https://x/y.png',
    })
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'client-id' })
  })

  it('throws InvalidGoogleTokenException when getPayload returns no sub', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'a@b.com' }) })
    const service = await compileModule()

    await expect(service.verify('id-token')).rejects.toBeInstanceOf(InvalidGoogleTokenException)
  })

  it('throws InvalidGoogleTokenException when verifyIdToken rejects', async () => {
    verifyIdToken.mockRejectedValue(new Error('signature mismatch'))
    const service = await compileModule()

    await expect(service.verify('id-token')).rejects.toBeInstanceOf(InvalidGoogleTokenException)
  })
})
```

- [ ] **Step 3.3: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/auth/google`

Expected: FAIL with "Cannot find module '../google-verifier.service'".

- [ ] **Step 3.4: Create `apps/api/src/modules/auth/google/google-verifier.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import { OAuth2Client } from 'google-auth-library'

import { ConfigService } from '../../../infra/config/config.service'
import { InvalidGoogleTokenException } from '../exceptions'

export interface GoogleProfile {
  sub: string
  email: string
  name?: string
  picture?: string
}

@Injectable()
export class GoogleVerifierService {
  private readonly client: OAuth2Client

  constructor(private readonly config: ConfigService) {
    this.client = new OAuth2Client(this.config.get('GOOGLE_CLIENT_ID'))
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    const audience = this.config.get('GOOGLE_CLIENT_ID')
    let payload: ReturnType<Awaited<ReturnType<OAuth2Client['verifyIdToken']>>['getPayload']>
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience })
      payload = ticket.getPayload()
    } catch (err) {
      throw new InvalidGoogleTokenException(err instanceof Error ? err.message : undefined)
    }
    if (!payload?.sub || !payload.email) {
      throw new InvalidGoogleTokenException('payload missing sub or email')
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    }
  }
}
```

- [ ] **Step 3.5: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/auth/google`

Expected: PASS — 3 tests.

- [ ] **Step 3.6: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 3.7: Commit**

```bash
git add apps/api/src/modules/auth/exceptions.ts apps/api/src/modules/auth/google/
git commit -m "$(cat <<'EOF'
feat(auth): add domain exceptions and google verifier service

Three HttpException subclasses with stable codes (invalid_google_token,
invalid_refresh_token, refresh_expired) for clients to branch on.
GoogleVerifierService wraps google-auth-library's verifyIdToken and
becomes the seam every auth test mocks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Token service — sign, verify, hash

**Files:**
- Create: `apps/api/src/modules/auth/token.service.ts`
- Create: `apps/api/src/modules/auth/__tests__/token.service.spec.ts`

`TokenService` owns JWT sign/verify and the SHA-256 hash. `issuePair` writes the `RefreshToken` row alongside signing — accepts an optional Prisma transaction client so `AuthService.rotate` can wrap revoke + insert atomically.

- [ ] **Step 4.1: Write the failing token-service spec**

Create `apps/api/src/modules/auth/__tests__/token.service.spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigService } from '../../../infra/config/config.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from '../exceptions'
import { TokenService } from '../token.service'

const ACCESS_SECRET = 'a'.repeat(32)
const REFRESH_SECRET = 'r'.repeat(32)

const buildConfigMock = () => ({
  get: vi.fn((key: string) => {
    if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET
    if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET
    return undefined
  }),
})

const buildPrismaMock = () => ({
  refreshToken: {
    create: vi.fn(),
  },
})

const compileModule = async (prisma: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TokenService,
      JwtService,
      { provide: ConfigService, useValue: buildConfigMock() },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile()
  return { service: moduleRef.get(TokenService), jwt: moduleRef.get(JwtService) }
}

describe('TokenService', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('issuePair', () => {
    it('signs an access JWT and a refresh JWT and persists the refresh hash', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service, jwt } = await compileModule(prisma)

      const pair = await service.issuePair(
        { id: 'u1', email: 'a@b.com' },
        { userAgent: 'curl/8.0', ip: '127.0.0.1' },
      )

      expect(pair.expiresIn).toBe(900)
      expect(pair.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
      expect(pair.refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)

      const accessPayload = jwt.verify<{ sub: string; email: string }>(pair.accessToken, {
        secret: ACCESS_SECRET,
      })
      expect(accessPayload).toMatchObject({ sub: 'u1', email: 'a@b.com' })

      const refreshPayload = jwt.verify<{ sub: string }>(pair.refreshToken, {
        secret: REFRESH_SECRET,
      })
      expect(refreshPayload.sub).toBe('u1')

      const createCall = prisma.refreshToken.create.mock.calls[0][0]
      expect(createCall.data).toMatchObject({
        userId: 'u1',
        userAgent: 'curl/8.0',
        ip: '127.0.0.1',
      })
      expect(createCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/)
      expect(createCall.data.tokenHash).toBe(service.hashToken(pair.refreshToken))
    })

    it('uses the provided Prisma transaction client when given', async () => {
      const txCreate = vi.fn().mockResolvedValue({})
      const tx = { refreshToken: { create: txCreate } }
      const prisma = buildPrismaMock()
      const { service } = await compileModule(prisma)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.issuePair({ id: 'u1', email: 'a@b.com' }, undefined, tx as any)

      expect(txCreate).toHaveBeenCalledTimes(1)
      expect(prisma.refreshToken.create).not.toHaveBeenCalled()
    })
  })

  describe('verifyRefresh', () => {
    it('returns sub from a valid refresh token', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service } = await compileModule(prisma)

      const pair = await service.issuePair({ id: 'u1', email: 'a@b.com' })
      const decoded = service.verifyRefresh(pair.refreshToken)

      expect(decoded).toEqual({ sub: 'u1' })
    })

    it('throws InvalidRefreshTokenException for a tampered token', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service } = await compileModule(prisma)

      const pair = await service.issuePair({ id: 'u1', email: 'a@b.com' })
      const tampered = pair.refreshToken.slice(0, -1) + (pair.refreshToken.slice(-1) === 'a' ? 'b' : 'a')

      expect(() => service.verifyRefresh(tampered)).toThrow(InvalidRefreshTokenException)
    })

    it('throws RefreshExpiredException for an expired token', async () => {
      const prisma = buildPrismaMock()
      prisma.refreshToken.create.mockResolvedValue({})
      const { service } = await compileModule(prisma)

      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const pair = await service.issuePair({ id: 'u1', email: 'a@b.com' })

      vi.setSystemTime(new Date('2026-03-01T00:00:00Z'))
      expect(() => service.verifyRefresh(pair.refreshToken)).toThrow(RefreshExpiredException)
    })
  })

  describe('hashToken', () => {
    it('produces a stable 64-char hex SHA-256 digest', async () => {
      const prisma = buildPrismaMock()
      const { service } = await compileModule(prisma)

      const hash1 = service.hashToken('hello')
      const hash2 = service.hashToken('hello')

      expect(hash1).toMatch(/^[a-f0-9]{64}$/)
      expect(hash1).toBe(hash2)
      expect(service.hashToken('world')).not.toBe(hash1)
    })
  })
})
```

- [ ] **Step 4.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/auth/__tests__/token.service.spec.ts`

Expected: FAIL with "Cannot find module '../token.service'".

- [ ] **Step 4.3: Create `apps/api/src/modules/auth/token.service.ts`**

```ts
import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { JwtService, TokenExpiredError } from '@nestjs/jwt'
import type { Prisma } from '@prisma/client'
import type { TokenPair } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { ConfigService } from '../../infra/config/config.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from './exceptions'

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

export type { TokenPair }

export interface TokenContext {
  userAgent?: string | null
  ip?: string | null
}

type PrismaWriter = Pick<PrismaService, 'refreshToken'> | Prisma.TransactionClient

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issuePair(
    user: { id: string; email: string },
    ctx?: TokenContext,
    client: PrismaWriter = this.prisma,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    )
    const refreshToken = this.jwt.sign(
      { sub: user.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    )
    const tokenHash = this.hashToken(refreshToken)
    await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        userAgent: ctx?.userAgent ?? null,
        ip: ctx?.ip ?? null,
      },
    })
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  }

  verifyRefresh(token: string): { sub: string } {
    try {
      return this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      })
    } catch (err) {
      if (err instanceof TokenExpiredError) throw new RefreshExpiredException()
      throw new InvalidRefreshTokenException()
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
```

- [ ] **Step 4.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/auth/__tests__/token.service.spec.ts`

Expected: PASS — 6 tests.

- [ ] **Step 4.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/modules/auth/token.service.ts apps/api/src/modules/auth/__tests__/token.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(auth): add token service for JWT issue/verify and refresh hashing

Signs access (15m) and refresh (30d) JWTs with separate secrets, persists
SHA-256(refresh) into the RefreshToken row, and accepts an optional
Prisma transaction client so AuthService.rotate can wrap revoke + insert
atomically. verifyRefresh translates jsonwebtoken errors into our
HttpException subclasses.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: JWT strategy and passport bridge

**Files:**
- Create: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `apps/api/src/modules/auth/strategies/__tests__/jwt.strategy.spec.ts`

`JwtStrategy` reads `JWT_ACCESS_SECRET` and decodes the `Authorization: Bearer ...` header. `validate()` returns `{ id: payload.sub, email: payload.email }` straight from claims — no DB hit per request.

- [ ] **Step 5.1: Write the failing strategy spec**

Create `apps/api/src/modules/auth/strategies/__tests__/jwt.strategy.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'

import { ConfigService } from '../../../../infra/config/config.service'
import { JwtStrategy } from '../jwt.strategy'

const ACCESS_SECRET = 'a'.repeat(32)

describe('JwtStrategy', () => {
  it('returns { id, email } from JWT claims with no DB lookup', async () => {
    const config = {
      get: vi.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    }
    const moduleRef = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: ConfigService, useValue: config }],
    }).compile()
    const strategy = moduleRef.get(JwtStrategy)

    const result = strategy.validate({ sub: 'u1', email: 'a@b.com' })

    expect(result).toEqual({ id: 'u1', email: 'a@b.com' })
  })
})
```

- [ ] **Step 5.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/auth/strategies`

Expected: FAIL with "Cannot find module '../jwt.strategy'".

- [ ] **Step 5.3: Create `apps/api/src/modules/auth/strategies/jwt.strategy.ts`**

```ts
import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { ConfigService } from '../../../infra/config/config.service'
import type { AuthedUser } from '../../../common/types/authed-request'

interface AccessTokenPayload {
  sub: string
  email: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    })
  }

  validate(payload: AccessTokenPayload): AuthedUser {
    return { id: payload.sub, email: payload.email }
  }
}
```

- [ ] **Step 5.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/auth/strategies`

Expected: PASS — 1 test.

- [ ] **Step 5.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 5.6: Commit**

```bash
git add apps/api/src/modules/auth/strategies/
git commit -m "$(cat <<'EOF'
feat(auth): add jwt passport strategy

Decodes Authorization: Bearer header against JWT_ACCESS_SECRET and
returns { id, email } from claims. No per-request DB hit — JWTs are
signed credentials that the strategy trusts. Future v2 account-suspension
work can switch to a DB lookup at this single call site.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: AuthService — login, rotate, logout

**Files:**
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`

`AuthService` orchestrates the three auth flows. `loginWithGoogle` wires verifier → users.upsert → tokens.issuePair. `rotate` validates the refresh row, then `$transaction(revoke + issuePair-with-tx)`. `logout` is idempotent.

- [ ] **Step 6.1: Write the failing auth-service spec**

Create `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthService } from '../auth.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from '../exceptions'
import { GoogleVerifierService } from '../google/google-verifier.service'
import { TokenService } from '../token.service'
import { UsersService } from '../../users/users.service'

const buildPrismaMock = () => ({
  refreshToken: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      refreshToken: {
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
    }),
  ),
})

const buildVerifierMock = () => ({ verify: vi.fn() })
const buildUsersMock = () => ({ upsertFromGoogle: vi.fn(), findById: vi.fn() })
const buildTokensMock = () => ({
  issuePair: vi.fn(),
  verifyRefresh: vi.fn(),
  hashToken: vi.fn((t: string) => `hash-of-${t}`),
})

const compileModule = async (
  prisma: ReturnType<typeof buildPrismaMock>,
  verifier: ReturnType<typeof buildVerifierMock>,
  users: ReturnType<typeof buildUsersMock>,
  tokens: ReturnType<typeof buildTokensMock>,
) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: GoogleVerifierService, useValue: verifier },
      { provide: UsersService, useValue: users },
      { provide: TokenService, useValue: tokens },
    ],
  }).compile()
  return moduleRef.get(AuthService)
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>
  let verifier: ReturnType<typeof buildVerifierMock>
  let users: ReturnType<typeof buildUsersMock>
  let tokens: ReturnType<typeof buildTokensMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
    verifier = buildVerifierMock()
    users = buildUsersMock()
    tokens = buildTokensMock()
  })

  describe('loginWithGoogle', () => {
    it('verifies, upserts the user, and issues a token pair', async () => {
      verifier.verify.mockResolvedValue({
        sub: 'g-1',
        email: 'a@b.com',
        name: 'Ana',
        picture: 'https://x/y.png',
      })
      users.upsertFromGoogle.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      tokens.issuePair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 })
      const service = await compileModule(prisma, verifier, users, tokens)

      const pair = await service.loginWithGoogle(
        { idToken: 'id-token' },
        { userAgent: 'curl/8.0', ip: '127.0.0.1' },
      )

      expect(verifier.verify).toHaveBeenCalledWith('id-token')
      expect(users.upsertFromGoogle).toHaveBeenCalledWith({
        googleSub: 'g-1',
        email: 'a@b.com',
        displayName: 'Ana',
        avatarUrl: 'https://x/y.png',
      })
      expect(tokens.issuePair).toHaveBeenCalledWith(
        { id: 'u1', email: 'a@b.com' },
        { userAgent: 'curl/8.0', ip: '127.0.0.1' },
      )
      expect(pair).toEqual({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 })
    })
  })

  describe('rotate', () => {
    it('rejects when the refresh row does not exist', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })

    it('rejects when the refresh row is already revoked', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })

    it('rejects when sub mismatches the row userId', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'someone-else',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })

    it('rejects when the row is past its expiresAt', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(RefreshExpiredException)
    })

    it('revokes old row and issues new pair atomically when valid', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-old',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      tokens.issuePair.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 })
      const service = await compileModule(prisma, verifier, users, tokens)

      const pair = await service.rotate('refresh-token', { userAgent: 'ua', ip: '1.1.1.1' })

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(tokens.issuePair).toHaveBeenCalledWith(
        { id: 'u1', email: 'a@b.com' },
        { userAgent: 'ua', ip: '1.1.1.1' },
        expect.any(Object),
      )
      expect(pair).toEqual({ accessToken: 'a2', refreshToken: 'r2', expiresIn: 900 })
    })

    it('rejects when users.findById returns null', async () => {
      tokens.verifyRefresh.mockReturnValue({ sub: 'u1' })
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      users.findById.mockResolvedValue(null)
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.rotate('refresh-token')).rejects.toBeInstanceOf(InvalidRefreshTokenException)
    })
  })

  describe('logout', () => {
    it('marks the row revokedAt when valid and not yet revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await service.logout('refresh-token')

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      })
    })

    it('is idempotent when the row is already revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
      })
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.logout('refresh-token')).resolves.toBeUndefined()
      expect(prisma.refreshToken.update).not.toHaveBeenCalled()
    })

    it('is idempotent when the row does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      const service = await compileModule(prisma, verifier, users, tokens)

      await expect(service.logout('refresh-token')).resolves.toBeUndefined()
      expect(prisma.refreshToken.update).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 6.2: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/auth/__tests__/auth.service.spec.ts`

Expected: FAIL with "Cannot find module '../auth.service'".

- [ ] **Step 6.3: Create `apps/api/src/modules/auth/auth.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import type { GoogleLogin, TokenPair } from '@rubik/shared'
import { PrismaService } from 'nestjs-prisma'

import { UsersService } from '../users/users.service'
import { InvalidRefreshTokenException, RefreshExpiredException } from './exceptions'
import { GoogleVerifierService } from './google/google-verifier.service'
import type { TokenContext } from './token.service'
import { TokenService } from './token.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleVerifier: GoogleVerifierService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async loginWithGoogle(input: GoogleLogin, ctx?: TokenContext): Promise<TokenPair> {
    const profile = await this.googleVerifier.verify(input.idToken)
    const user = await this.users.upsertFromGoogle({
      googleSub: profile.sub,
      email: profile.email,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    })
    return this.tokens.issuePair({ id: user.id, email: user.email }, ctx)
  }

  async rotate(refreshToken: string, ctx?: TokenContext): Promise<TokenPair> {
    const { sub } = this.tokens.verifyRefresh(refreshToken)
    const tokenHash = this.tokens.hashToken(refreshToken)
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!row || row.userId !== sub || row.revokedAt) {
      throw new InvalidRefreshTokenException()
    }
    if (row.expiresAt < new Date()) {
      throw new RefreshExpiredException()
    }
    const user = await this.users.findById(sub)
    if (!user) {
      throw new InvalidRefreshTokenException()
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      })
      return this.tokens.issuePair({ id: user.id, email: user.email }, ctx, tx)
    })
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashToken(refreshToken)
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!row || row.revokedAt) return
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    })
  }
}
```

- [ ] **Step 6.4: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/auth/__tests__/auth.service.spec.ts`

Expected: PASS — 9 tests.

- [ ] **Step 6.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 6.6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/__tests__/auth.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(auth): add auth service for login, rotation, logout

Orchestrates Google verify → user upsert → token issue for login;
verifies refresh row + transactionally revokes old + issues new for
rotate (simple rotation per design Q2); idempotent revoke for logout.
Sub mismatch and missing user both fail closed as invalid_refresh_token.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: AuthController + AuthModule + DTOs

**Files:**
- Create: `apps/api/src/modules/auth/dto/google-login.dto.ts`
- Create: `apps/api/src/modules/auth/dto/refresh-request.dto.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`

DTOs are zod schemas from `@rubik/shared` lifted into `nestjs-zod` `createZodDto` for Swagger surfacing later. Controller uses three handlers; all `@Public()`. `AuthModule` registers `JwtStrategy`, `JwtService`, and the `PassportModule` with `defaultStrategy: 'jwt'` (this becomes `@Global()` so `JwtAuthGuard` resolves the strategy app-wide).

- [ ] **Step 7.1: Create `apps/api/src/modules/auth/dto/google-login.dto.ts`**

```ts
import { GoogleLoginSchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class GoogleLoginDto extends createZodDto(GoogleLoginSchema) {}
```

- [ ] **Step 7.2: Create `apps/api/src/modules/auth/dto/refresh-request.dto.ts`**

```ts
import { RefreshRequestSchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class RefreshRequestDto extends createZodDto(RefreshRequestSchema) {}
```

- [ ] **Step 7.3: Create `apps/api/src/modules/auth/auth.controller.ts`**

```ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common'
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { TokenPair } from '@rubik/shared'

import { Public } from '../../common/decorators/public.decorator'
import { AuthService } from './auth.service'
import { GoogleLoginDto } from './dto/google-login.dto'
import { RefreshRequestDto } from './dto/refresh-request.dto'

const extractContext = (req: Request) => ({
  userAgent: req.get('user-agent') ?? null,
  ip: req.ip ?? null,
})

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('google')
  @ApiOkResponse({ description: 'TokenPair on a verified Google ID token' })
  google(@Body() body: GoogleLoginDto, @Req() req: Request): Promise<TokenPair> {
    return this.auth.loginWithGoogle(body, extractContext(req))
  }

  @Public()
  @Post('refresh')
  @ApiOkResponse({ description: 'New TokenPair; old refresh is revoked' })
  refresh(@Body() body: RefreshRequestDto, @Req() req: Request): Promise<TokenPair> {
    return this.auth.rotate(body.refreshToken, extractContext(req))
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Refresh token revoked (idempotent)' })
  async logout(@Body() body: RefreshRequestDto): Promise<void> {
    await this.auth.logout(body.refreshToken)
  }
}
```

- [ ] **Step 7.4: Create `apps/api/src/modules/auth/auth.module.ts`**

```ts
import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { GoogleVerifierService } from './google/google-verifier.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { TokenService } from './token.service'

@Global()
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, GoogleVerifierService, JwtStrategy],
  exports: [TokenService, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
```

- [ ] **Step 7.5: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 7.6: All auth specs still green**

Run: `pnpm --filter @rubik/api test src/modules/auth`

Expected: 19 tests pass (3 + 6 + 1 + 9).

- [ ] **Step 7.7: Commit**

```bash
git add apps/api/src/modules/auth/dto/ apps/api/src/modules/auth/auth.controller.ts apps/api/src/modules/auth/auth.module.ts
git commit -m "$(cat <<'EOF'
feat(auth): add controller, dtos, and module wiring

POST /v1/auth/{google,refresh,logout} all marked @Public so they remain
reachable once JwtAuthGuard becomes APP_GUARD. AuthModule registers
PassportModule(jwt), JwtModule, and JwtStrategy as @Global so the guard
in common/ resolves app-wide. DTOs lift @rubik/shared zod schemas via
nestjs-zod for future Swagger surfacing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Me exceptions + MeService

**Files:**
- Create: `apps/api/src/modules/me/exceptions.ts`
- Create: `apps/api/src/modules/me/me.service.ts`
- Create: `apps/api/src/modules/me/__tests__/me.service.spec.ts`

`MeService` resolves slug → caseId, validates variant ownership, and runs the upsert / delete. `ChosenVariantInvalidException` (422) is the only new exception; `CaseNotFoundException` is reused from `catalog/exceptions.ts`.

- [ ] **Step 8.1: Create `apps/api/src/modules/me/exceptions.ts`**

```ts
import { HttpException, HttpStatus } from '@nestjs/common'

const buildPayload = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : {}),
})

export class ChosenVariantInvalidException extends HttpException {
  constructor(chosenVariantId: string, caseId: string) {
    super(
      buildPayload(
        'chosen_variant_invalid',
        `Variant "${chosenVariantId}" does not belong to the requested case`,
        { chosenVariantId, caseId },
      ),
      HttpStatus.UNPROCESSABLE_ENTITY,
    )
  }
}
```

- [ ] **Step 8.2: Write the failing me-service spec**

Create `apps/api/src/modules/me/__tests__/me.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'nestjs-prisma'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CaseNotFoundException } from '../../catalog/exceptions'
import { ChosenVariantInvalidException } from '../exceptions'
import { MeService } from '../me.service'

const buildPrismaMock = () => ({
  user: {
    findUniqueOrThrow: vi.fn(),
  },
  algorithmCase: {
    findFirst: vi.fn(),
  },
  algorithmVariant: {
    findFirst: vi.fn(),
  },
  userAlgorithm: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
})

const compileModule = async (prismaMock: ReturnType<typeof buildPrismaMock>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [MeService, { provide: PrismaService, useValue: prismaMock }],
  }).compile()
  return moduleRef.get(MeService)
}

describe('MeService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
  })

  describe('getCurrent', () => {
    it('returns the user via findUniqueOrThrow', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', email: 'a@b.com' })
      const service = await compileModule(prisma)

      const result = await service.getCurrent('u1')

      expect(result).toEqual({ id: 'u1', email: 'a@b.com' })
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'u1' } })
    })
  })

  describe('listAlgorithms', () => {
    it('returns user algorithms ordered by updatedAt desc', async () => {
      prisma.userAlgorithm.findMany.mockResolvedValue([
        { userId: 'u1', caseId: 'c1', status: 'LEARNING', chosenVariantId: null, personalNotesMd: null, updatedAt: new Date() },
      ])
      const service = await compileModule(prisma)

      await service.listAlgorithms('u1')

      expect(prisma.userAlgorithm.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { updatedAt: 'desc' },
      })
    })
  })

  describe('upsertAlgorithm', () => {
    it('throws CaseNotFoundException when slug does not resolve', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(
        service.upsertAlgorithm('u1', 'unknown-slug', { status: 'LEARNING' }),
      ).rejects.toBeInstanceOf(CaseNotFoundException)
    })

    it('throws ChosenVariantInvalidException when variant does not belong to the case', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.algorithmVariant.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(
        service.upsertAlgorithm('u1', 't-perm', { chosenVariantId: 'v-bad' }),
      ).rejects.toBeInstanceOf(ChosenVariantInvalidException)
      expect(prisma.algorithmVariant.findFirst).toHaveBeenCalledWith({
        where: { id: 'v-bad', caseId: 'c1' },
      })
    })

    it('skips variant validation when chosenVariantId is null', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.userAlgorithm.upsert.mockResolvedValue({
        userId: 'u1',
        caseId: 'c1',
        chosenVariantId: null,
        status: 'LEARNED',
        personalNotesMd: null,
        updatedAt: new Date(),
      })
      const service = await compileModule(prisma)

      await service.upsertAlgorithm('u1', 't-perm', { chosenVariantId: null, status: 'LEARNED' })

      expect(prisma.algorithmVariant.findFirst).not.toHaveBeenCalled()
      expect(prisma.userAlgorithm.upsert).toHaveBeenCalledWith({
        where: { userId_caseId: { userId: 'u1', caseId: 'c1' } },
        create: { userId: 'u1', caseId: 'c1', chosenVariantId: null, status: 'LEARNED' },
        update: { chosenVariantId: null, status: 'LEARNED' },
      })
    })

    it('upserts when slug + variant validate', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.algorithmVariant.findFirst.mockResolvedValue({ id: 'v1' })
      prisma.userAlgorithm.upsert.mockResolvedValue({
        userId: 'u1',
        caseId: 'c1',
        chosenVariantId: 'v1',
        status: 'LEARNING',
        personalNotesMd: 'note',
        updatedAt: new Date(),
      })
      const service = await compileModule(prisma)

      const result = await service.upsertAlgorithm('u1', 't-perm', {
        chosenVariantId: 'v1',
        status: 'LEARNING',
        personalNotesMd: 'note',
      })

      expect(result.chosenVariantId).toBe('v1')
      expect(prisma.userAlgorithm.upsert).toHaveBeenCalledWith({
        where: { userId_caseId: { userId: 'u1', caseId: 'c1' } },
        create: {
          userId: 'u1',
          caseId: 'c1',
          chosenVariantId: 'v1',
          status: 'LEARNING',
          personalNotesMd: 'note',
        },
        update: { chosenVariantId: 'v1', status: 'LEARNING', personalNotesMd: 'note' },
      })
    })
  })

  describe('deleteAlgorithm', () => {
    it('throws CaseNotFoundException when slug does not resolve', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue(null)
      const service = await compileModule(prisma)

      await expect(service.deleteAlgorithm('u1', 'unknown-slug')).rejects.toBeInstanceOf(
        CaseNotFoundException,
      )
    })

    it('deletes when row exists', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      prisma.userAlgorithm.delete.mockResolvedValue({})
      const service = await compileModule(prisma)

      await service.deleteAlgorithm('u1', 't-perm')

      expect(prisma.userAlgorithm.delete).toHaveBeenCalledWith({
        where: { userId_caseId: { userId: 'u1', caseId: 'c1' } },
      })
    })

    it('swallows P2025 (record not found) for idempotency', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      const notFound = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      })
      prisma.userAlgorithm.delete.mockRejectedValue(notFound)
      const service = await compileModule(prisma)

      await expect(service.deleteAlgorithm('u1', 't-perm')).resolves.toBeUndefined()
    })

    it('rethrows non-P2025 prisma errors', async () => {
      prisma.algorithmCase.findFirst.mockResolvedValue({ id: 'c1' })
      const otherError = new Prisma.PrismaClientKnownRequestError('other', {
        code: 'P2002',
        clientVersion: 'test',
      })
      prisma.userAlgorithm.delete.mockRejectedValue(otherError)
      const service = await compileModule(prisma)

      await expect(service.deleteAlgorithm('u1', 't-perm')).rejects.toBe(otherError)
    })
  })
})
```

- [ ] **Step 8.3: Run the spec to verify it fails**

Run: `pnpm --filter @rubik/api test src/modules/me`

Expected: FAIL with "Cannot find module '../me.service'".

- [ ] **Step 8.4: Create `apps/api/src/modules/me/me.service.ts`**

```ts
import { Injectable } from '@nestjs/common'
import { Prisma, type User, type UserAlgorithm } from '@prisma/client'
import { PrismaService } from 'nestjs-prisma'

import type { UpdateUserAlgorithm } from '@rubik/shared'

import { CaseNotFoundException } from '../catalog/exceptions'
import { ChosenVariantInvalidException } from './exceptions'

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  getCurrent(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  }

  listAlgorithms(userId: string): Promise<UserAlgorithm[]> {
    return this.prisma.userAlgorithm.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async upsertAlgorithm(
    userId: string,
    caseSlug: string,
    body: UpdateUserAlgorithm,
  ): Promise<UserAlgorithm> {
    const c = await this.prisma.algorithmCase.findFirst({
      where: { slug: caseSlug },
      select: { id: true },
    })
    if (!c) throw new CaseNotFoundException(caseSlug)
    const caseId = c.id

    if (body.chosenVariantId != null) {
      const variant = await this.prisma.algorithmVariant.findFirst({
        where: { id: body.chosenVariantId, caseId },
        select: { id: true },
      })
      if (!variant) throw new ChosenVariantInvalidException(body.chosenVariantId, caseId)
    }

    return this.prisma.userAlgorithm.upsert({
      where: { userId_caseId: { userId, caseId } },
      create: { userId, caseId, ...body },
      update: { ...body },
    })
  }

  async deleteAlgorithm(userId: string, caseSlug: string): Promise<void> {
    const c = await this.prisma.algorithmCase.findFirst({
      where: { slug: caseSlug },
      select: { id: true },
    })
    if (!c) throw new CaseNotFoundException(caseSlug)

    try {
      await this.prisma.userAlgorithm.delete({
        where: { userId_caseId: { userId, caseId: c.id } },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return
      throw err
    }
  }
}
```

- [ ] **Step 8.5: Run the spec to verify it passes**

Run: `pnpm --filter @rubik/api test src/modules/me`

Expected: PASS — 9 tests.

- [ ] **Step 8.6: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 8.7: Commit**

```bash
git add apps/api/src/modules/me/exceptions.ts apps/api/src/modules/me/me.service.ts apps/api/src/modules/me/__tests__/me.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(me): add me service with personal-sheet upsert/delete

MeService resolves caseSlug → caseId, enforces variant-ownership
(422 chosen_variant_invalid), upserts on the composite (userId, caseId)
key, and swallows Prisma P2025 on delete for idempotency. Reuses
CaseNotFoundException from catalog/exceptions.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: MeController + MeModule

**Files:**
- Create: `apps/api/src/modules/me/dto/update-user-algorithm.dto.ts`
- Create: `apps/api/src/modules/me/me.controller.ts`
- Create: `apps/api/src/modules/me/me.module.ts`

`MeController` is the only authenticated controller in this sub-phase — every handler relies on the global `JwtAuthGuard` to populate `req.user`. No `@Public()`. `DELETE` returns 204 via `@HttpCode(HttpStatus.NO_CONTENT)`.

- [ ] **Step 9.1: Create `apps/api/src/modules/me/dto/update-user-algorithm.dto.ts`**

```ts
import { UpdateUserAlgorithmSchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateUserAlgorithmDto extends createZodDto(UpdateUserAlgorithmSchema) {}
```

- [ ] **Step 9.2: Create `apps/api/src/modules/me/me.controller.ts`**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common'
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { User, UserAlgorithm } from '@prisma/client'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthedUser } from '../../common/types/authed-request'
import { UpdateUserAlgorithmDto } from './dto/update-user-algorithm.dto'
import { MeService } from './me.service'

@ApiTags('me')
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get()
  @ApiOkResponse({ description: 'The authenticated user' })
  getCurrent(@CurrentUser() user: AuthedUser): Promise<User> {
    return this.service.getCurrent(user.id)
  }

  @Get('algorithms')
  @ApiOkResponse({ description: 'Personal algorithm sheet ordered by updatedAt desc' })
  listAlgorithms(@CurrentUser() user: AuthedUser): Promise<UserAlgorithm[]> {
    return this.service.listAlgorithms(user.id)
  }

  @Put('algorithms/:caseSlug')
  @ApiOkResponse({ description: 'Upsert the user-algorithm row for the case' })
  upsertAlgorithm(
    @CurrentUser() user: AuthedUser,
    @Param('caseSlug') caseSlug: string,
    @Body() body: UpdateUserAlgorithmDto,
  ): Promise<UserAlgorithm> {
    return this.service.upsertAlgorithm(user.id, caseSlug, body)
  }

  @Delete('algorithms/:caseSlug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Idempotent delete of the user-algorithm row' })
  deleteAlgorithm(
    @CurrentUser() user: AuthedUser,
    @Param('caseSlug') caseSlug: string,
  ): Promise<void> {
    return this.service.deleteAlgorithm(user.id, caseSlug)
  }
}
```

- [ ] **Step 9.3: Create `apps/api/src/modules/me/me.module.ts`**

```ts
import { Module } from '@nestjs/common'

import { UsersModule } from '../users/users.module'
import { MeController } from './me.controller'
import { MeService } from './me.service'

@Module({
  imports: [UsersModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
```

- [ ] **Step 9.4: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 9.5: All me specs still green**

Run: `pnpm --filter @rubik/api test src/modules/me`

Expected: 9 tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add apps/api/src/modules/me/dto/ apps/api/src/modules/me/me.controller.ts apps/api/src/modules/me/me.module.ts
git commit -m "$(cat <<'EOF'
feat(me): add controller and module for /v1/me/*

GET /v1/me, GET /v1/me/algorithms, PUT /v1/me/algorithms/:caseSlug,
DELETE /v1/me/algorithms/:caseSlug. CurrentUser() pulls req.user
populated by the global JwtAuthGuard. DELETE returns 204 idempotently.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Wire AuthModule + MeModule + APP_GUARD JwtAuthGuard

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/common/guards/jwt-auth.guard.ts`

This is the integration point: import `AuthModule` + `MeModule`, register `JwtAuthGuard` as `APP_GUARD`, and remove the TODO comment from the guard so it stops claiming it's not wired.

- [ ] **Step 10.1: Edit `apps/api/src/app.module.ts`**

Replace the file with:

```ts
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { CacheModule } from './infra/cache/cache.module'
import { ConfigModule } from './infra/config/config.module'
import { LoggerModule } from './infra/logger/logger.module'
import { PrismaModule } from './infra/prisma/prisma.module'
import { TelemetryModule } from './infra/telemetry/telemetry.module'
import { ThrottlerModule } from './infra/throttler/throttler.module'
import { AuthModule } from './modules/auth/auth.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { HealthModule } from './modules/health/health.module'
import { MeModule } from './modules/me/me.module'

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    TelemetryModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    MeModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

- [ ] **Step 10.2: Edit `apps/api/src/common/guards/jwt-auth.guard.ts`**

Remove the two-line TODO block:

```ts
// TODO(ducbach, 2026-04-26): wire as APP_GUARD in app.module.ts when AuthModule lands (sub-phase 4 of plan 05).
// Until then, IS_PUBLIC_KEY metadata set by @Public() / @PublicCacheable() is inert at runtime.
```

The file should become:

```ts
import { type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (isPublic) return true
    return super.canActivate(context)
  }
}
```

- [ ] **Step 10.3: Typecheck**

Run: `pnpm --filter @rubik/api typecheck`

Expected: clean.

- [ ] **Step 10.4: Full test suite still green**

Run: `pnpm --filter @rubik/api test`

Expected: every pre-existing spec + the new auth/users/me specs all pass (catalog 14 + users 4 + auth 19 + me 9 = 46 unit tests across the api).

- [ ] **Step 10.5: Lint**

Run: `pnpm --filter @rubik/api lint`

Expected: clean.

- [ ] **Step 10.6: Boot the api against Compose to confirm it starts cleanly**

Run (in a separate terminal or background): `pnpm --filter @rubik/api dev`

Watch the log for: NestJS bootstrap success on port 3001; no errors about missing providers, missing JwtStrategy, or DI cycles.

In another terminal:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/healthz
# Expected: 200

curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/v1/me
# Expected: 401   (guard fires by default; @Public not set on /v1/me)

curl -s http://localhost:3001/v1/puzzles | head -c 100
# Expected: a JSON array (empty `[]` until plan 06 seeds content) — verifies @PublicCacheable still works
```

Stop the dev server when done.

- [ ] **Step 10.7: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/common/guards/jwt-auth.guard.ts
git commit -m "$(cat <<'EOF'
feat(api): wire auth + me modules and register jwt-auth-guard as app_guard

JwtAuthGuard now fires on every request by default; @Public on health
and /v1/auth/* keeps the bootstrapping endpoints reachable, and the
catalog's @PublicCacheable composes @Public so existing endpoints stay
public-cacheable. Removes the TODO that warned the guard was inert.

Closes the 'authenticated /v1/me round-trip' line item in plan 05's
Done-when checklist (modulo manual smoke verification).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual smoke verification

This task does not produce a commit. It validates the round-trip per the design's smoke checklist and surfaces any regressions before the sub-phase closes.

- [ ] **Step 11.1: Boot api against Compose**

Run: `pnpm --filter @rubik/api dev`

Confirm: bootstrap log shows `Nest application successfully started`; no DI errors; port 3001 listening.

- [ ] **Step 11.2: Liveness — health bypass works**

Run: `curl -i http://localhost:3001/healthz`

Expected: `HTTP/1.1 200 OK`; body `{"status":"ok"}`. Confirms `@Public()` overrides the global guard.

- [ ] **Step 11.3: Readiness — Postgres + Redis check**

Run: `curl -i http://localhost:3001/readyz`

Expected: `HTTP/1.1 200 OK`; body `{"status":"ok","info":{"prisma":{"status":"up"},"redis":{"status":"up"}},...}`.

- [ ] **Step 11.4: Unauthenticated /v1/me returns 401**

Run: `curl -i http://localhost:3001/v1/me`

Expected: `HTTP/1.1 401`; body `{"error":{"code":"unauthorized","message":"Unauthorized"}}` (or similar — code may surface as `unauthorized` from the AllExceptionsFilter normalization). Confirms the guard fires.

- [ ] **Step 11.5: Catalog still public**

Run: `curl -i http://localhost:3001/v1/puzzles`

Expected: `HTTP/1.1 200 OK`; `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`; body `[]`. Confirms `@PublicCacheable()` carries `@Public` through.

- [ ] **Step 11.6: Auth/google bad token rejects with stable code**

Run: `curl -i -X POST http://localhost:3001/v1/auth/google -H 'content-type: application/json' -d '{"idToken":"not-a-jwt"}'`

Expected: `HTTP/1.1 401`; body `{"error":{"code":"invalid_google_token", ...}}`. Confirms `@Public` on the auth handler + `GoogleVerifierService` rejection path.

- [ ] **Step 11.7: Auth/refresh bad token rejects**

Run: `curl -i -X POST http://localhost:3001/v1/auth/refresh -H 'content-type: application/json' -d '{"refreshToken":"not-a-jwt"}'`

Expected: `HTTP/1.1 401`; body `{"error":{"code":"invalid_refresh_token", ...}}`.

- [ ] **Step 11.8: Validation error shape**

Run: `curl -i -X POST http://localhost:3001/v1/auth/google -H 'content-type: application/json' -d '{}'`

Expected: `HTTP/1.1 422`; body `{"error":{"code":"validation_error", "details":[...]}}`. Confirms `ZodValidationPipe` + `AllExceptionsFilter` shape are intact.

- [ ] **Step 11.9: Live Google ID token round-trip (only if credentials handy; otherwise skip)**

This is the real "Done when" line item. To run it, generate an ID token via [Google's OAuth Playground](https://developers.google.com/oauthplayground): pick scopes `openid email profile`, exchange the code, copy the `id_token`.

```bash
ID_TOKEN='<from playground>'
curl -s -X POST http://localhost:3001/v1/auth/google \
  -H 'content-type: application/json' \
  -d "{\"idToken\":\"$ID_TOKEN\"}" | tee /tmp/auth.json

ACCESS=$(jq -r .accessToken /tmp/auth.json)
REFRESH=$(jq -r .refreshToken /tmp/auth.json)

curl -i -H "Authorization: Bearer $ACCESS" http://localhost:3001/v1/me
# Expected: 200 with the user's profile

curl -s -X POST http://localhost:3001/v1/auth/refresh \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | tee /tmp/refresh.json
# Expected: 200 with new pair

curl -i -X POST http://localhost:3001/v1/auth/refresh \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"
# Expected: 401 invalid_refresh_token (replay rejection)

curl -i -X POST http://localhost:3001/v1/auth/logout \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$(jq -r .refreshToken /tmp/refresh.json)\"}"
# Expected: 204 No Content
```

If you don't have Google credentials handy, skip this step and document it in the PR description as "verified post-merge once OAuth Playground access is available."

- [ ] **Step 11.10: PUT /v1/me/algorithms/:caseSlug returns 404 pre-content-seed**

Run (using a valid `$ACCESS` from Step 11.9 if available; otherwise sign one manually with the running secret — easiest to skip if Step 11.9 was skipped):

```bash
curl -i -X PUT "http://localhost:3001/v1/me/algorithms/t-perm" \
  -H "Authorization: Bearer $ACCESS" \
  -H 'content-type: application/json' \
  -d '{"status":"LEARNING"}'
```

Expected (pre-plan-06): `HTTP/1.1 404`; body `{"error":{"code":"case_not_found","details":{"slug":"t-perm"}}}`. Confirms slug resolution + auth gate both work end-to-end.

- [ ] **Step 11.11: Stop the dev server**

Ctrl-C the `pnpm dev` process.

If any step fails: do not close the sub-phase. Open a follow-up commit with the fix.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

Run: `git log --oneline -15`

Expected (newest first):
```
<hash> feat(api): wire auth + me modules and register jwt-auth-guard as app_guard
<hash> feat(me): add controller and module for /v1/me/*
<hash> feat(me): add me service with personal-sheet upsert/delete
<hash> feat(auth): add controller, dtos, and module wiring
<hash> feat(auth): add auth service for login, rotation, logout
<hash> feat(auth): add jwt passport strategy
<hash> feat(auth): add token service for JWT issue/verify and refresh hashing
<hash> feat(auth): add domain exceptions and google verifier service
<hash> feat(api): add users module with upsertFromGoogle and findById
<hash> feat(api): require GOOGLE_CLIENT_ID outside test + add CurrentUser decorator
b37acb6 docs(plans): add api sub-phase 4 design
...
```

- [ ] **Step F.2: Confirm full api suite + lint clean**

Run: `pnpm --filter @rubik/api typecheck && pnpm --filter @rubik/api lint && pnpm --filter @rubik/api test`

Expected: all green.

- [ ] **Step F.3: Sub-phase done-when checklist (paste into PR description)**

```
- [x] apps/api/src/modules/{auth,users,me}/ created and wired in app.module.ts
- [x] JwtAuthGuard registered as APP_GUARD; TODO comment removed; @Public() on health + auth handlers
- [x] GoogleVerifierService, TokenService, AuthService, UsersService, MeService, JwtStrategy implemented per data-flow spec
- [x] InvalidGoogleTokenException, InvalidRefreshTokenException, RefreshExpiredException, ChosenVariantInvalidException defined with stable codes
- [x] All six unit-test specs pass (pnpm --filter @rubik/api test)
- [x] Smoke checklist 1–8 verified locally; step 9–10 documented if Google credentials unavailable
- [x] pnpm typecheck && pnpm lint clean
- [x] Commits follow lowercase Conventional Commits with scopes auth, api, users, me as appropriate
```

---

## Out of scope reminder (do not implement)

- Testcontainers integration tests
- Theft-detection refresh rotation (revoked-replayed → mass-revoke)
- Throttler `@Throttle()` decorators on auth endpoints — `ThrottlerGuard` is not wired as `APP_GUARD` yet, so any decorator would be a no-op. Defer wiring to a dedicated sub-phase
- Account suspension / deactivation
- Pagination or `?status=` filter on `/v1/me/algorithms`
- Refresh-token row pruning cron
- Auth.js v5 (web side) — plan 07
- Swagger UI mount + full DTO spec — defer to sub-phase 6 area
- PATCH `/v1/me` — not in §5.1
