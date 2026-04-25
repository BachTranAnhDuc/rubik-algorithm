# Plan 05 Sub-Phase 1 — `apps/api` Platform Skeleton

The first slice of plan 05. Ships the api process: it boots via `make dev.api`, exposes liveness and readiness, and has every cross-cutting concern wired (config, logging, caching, throttling, telemetry, validation) so feature modules in later sub-phases just plug in.

## 1. Goal and non-goals

### 1.1 Goal

A NestJS process that starts cleanly against the Compose stack, returns 200 on `/v1/healthz` and `/v1/readyz` (Postgres + Redis pings), and has the entire `infra/` + `common/` foundation in place. Feature modules (auth, catalog, scramble, search, me) land in subsequent sub-phases against this base.

### 1.2 Non-goals

- Prisma schema and migrations — sub-phase 2.
- Catalog, auth, me, scramble, search — sub-phases 3–5.
- OpenAPI emission, Dockerfile, integration tests via Testcontainers — sub-phase 6.
- Real OTLP / Sentry endpoints. Telemetry is scaffolded but env-gated; with the env vars unset, both integrations are no-ops.
- `cookie-parser` and any cookie-handling middleware on the api. Web's BFF owns cookies; api accepts only `Authorization: Bearer …`.

### 1.3 Method

Hand-rolled scaffold (no `nest new`) so the workspace shape matches the rest of the monorepo from the first commit. Every file lands at the location §18.2 specifies. Telemetry init lives in a separate `tracing.ts` imported first in `main.ts` so OTel auto-instrumentation wraps NestJS during DI.

---

## 2. Workspace layout

```
apps/api/
├── package.json                       name: @rubik/api
├── tsconfig.json                      extends root, decorators on
├── tsconfig.build.json
├── nest-cli.json
├── .env.example                       documents every env var
├── vitest.config.ts
└── src/
    ├── main.ts                        bootstrap: telemetry → Nest → listen
    ├── app.module.ts                  composes infra + health
    │
    ├── common/
    │   ├── decorators/
    │   │   ├── current-user.decorator.ts
    │   │   └── public.decorator.ts
    │   ├── dtos/
    │   │   ├── error.dto.ts
    │   │   └── pagination.dto.ts
    │   ├── filters/all-exceptions.filter.ts
    │   ├── guards/jwt-auth.guard.ts            (skeleton; not registered yet)
    │   ├── interceptors/
    │   │   ├── logging.interceptor.ts
    │   │   └── cache.interceptor.ts            (re-export of @nestjs/cache-manager)
    │   └── pipes/zod-validation.pipe.ts        (re-export of nestjs-zod)
    │
    ├── infra/
    │   ├── config/
    │   │   ├── env.schema.ts                   zod env schema
    │   │   ├── config.module.ts                @Global
    │   │   └── config.service.ts
    │   ├── prisma/
    │   │   ├── prisma.module.ts                @Global, via nestjs-prisma
    │   │   └── prisma.service.ts               (sub-phase 2 fills it in)
    │   ├── cache/
    │   │   ├── cache.module.ts                 Redis-backed
    │   │   └── cache.service.ts
    │   ├── logger/logger.module.ts             nestjs-pino
    │   ├── throttler/throttler.module.ts       Redis storage
    │   └── telemetry/
    │       ├── telemetry.module.ts
    │       ├── tracing.ts                      OTel SDK, env-gated
    │       └── sentry.ts                       env-gated
    │
    └── modules/
        └── health/
            ├── health.module.ts
            ├── health.controller.ts            /healthz + /readyz
            └── health.controller.spec.ts
```

---

## 3. Library inventory (sub-phase 1)

Per §18.1 of the master design, minus `cookie-parser`. Pinned in `apps/api/package.json`:

**Runtime:** `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/throttler`, `@nestjs/terminus`, `@nestjs/cache-manager`, `cache-manager`, `cache-manager-redis-yet`, `@nestjs/schedule`, `nestjs-pino`, `pino`, `pino-http`, `pino-pretty`, `nestjs-zod`, `nestjs-prisma`, `prisma`, `@prisma/client`, `google-auth-library`, `helmet`, `compression`, `dayjs`, `cuid2`, `zod`, `reflect-metadata`, `rxjs`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@sentry/node`, `@sentry/profiling-node`.

**Dev:** `@nestjs/cli`, `@nestjs/testing`, `@types/express`, `@types/passport-jwt`, `@types/compression`, `@types/node`, `@types/supertest`, `supertest`, `testcontainers`, `vitest`, `@vitest/coverage-v8`, `tsx`, `typescript`.

**Workspace:** `@rubik/shared` (workspace:*).

The two largest deps (`@opentelemetry/auto-instrumentations-node`, `prisma`) are installed even in sub-phase 1 to lock the dep graph; turning them on is one env var.

---

## 4. Boot order in `main.ts`

The order is load-bearing:

```ts
// main.ts (shape; final code may differ in detail)
import 'reflect-metadata'
import './infra/telemetry/tracing'                 // OTel SDK; first import
import './infra/telemetry/sentry'                  // Sentry; second

import { NestFactory } from '@nestjs/core'
import { Logger as PinoLogger } from 'nestjs-pino'
import { VersioningType } from '@nestjs/common'
import compression from 'compression'
import helmet from 'helmet'

import { AppModule } from './app.module'

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(PinoLogger))
  app.use(helmet())
  app.use(compression())
  app.enableShutdownHooks()
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.setGlobalPrefix('v1', { exclude: [] })  // versioning handles path; this is for /docs etc.
  await app.listen(process.env.PORT ?? 3001)
}

void bootstrap()
```

**Why telemetry imports come first:** the OTel SDK patches the global `require`/`import` graph to wrap modules during load. If NestFactory or any of its deps load before `tracing.ts`, those modules aren't instrumented for the lifetime of the process. ESLint's import-sort rule needs `// eslint-disable-next-line simple-import-sort/imports` on the side-effect block (or a `disable`/`enable` pair) — the load-bearing order is the point.

---

## 5. Cross-cutting wiring

**Validation.** `ZodValidationPipe` from `nestjs-zod` registered as `APP_PIPE` global in `AppModule`. Schemas come from `packages/shared/schemas/` (sub-phase 3 onward). Errors throw `ZodError`, caught by the exception filter, returned as HTTP 422.

**Errors.** `AllExceptionsFilter` registered as `APP_FILTER` global. Returns `{ error: { code, message, details? }, requestId }`. Domain exceptions (`CaseNotFoundException` etc.) extend `HttpException` with stable `code`s — those classes land in their feature modules.

**Logging.** `LoggerModule.forRoot({ pinoHttp: { genReqId } })` in `infra/logger`. Pretty transport in dev, JSON in prod. `LoggingInterceptor` registered as `APP_INTERCEPTOR` global, logging `method path status durationMs userId?` once per request.

**Auth.** `JwtAuthGuard` lives in `common/guards/` with the strategy reference but is **not** registered as `APP_GUARD` yet. That happens in sub-phase 4 (auth module) so `/healthz` doesn't need a `@Public` decorator at boot time. `@Public()` and `@CurrentUser()` decorators land now anyway since they're framework primitives, but no consumer yet.

**Caching.** `CacheModule.registerAsync({ useFactory: redisStore })` reading host/port from `ConfigService`. `CacheInterceptor` is the framework default; we re-export it under `common/interceptors/` for one-import discoverability.

**Throttling.** `ThrottlerModule.forRootAsync` with Redis storage adapter. Defaults from §18.4: 60/min/IP public, 120/min/user authed, 10/min/IP on `/v1/auth/*`. Per-route `@Throttle` overrides.

**Telemetry.** `tracing.ts` reads `OTEL_EXPORTER_OTLP_ENDPOINT`; if absent, returns silently (no SDK started). `sentry.ts` reads `SENTRY_DSN`; same behavior. This means a fresh dev environment with no telemetry creds Just Works.

---

## 6. Health module

Two routes, both `@Public()` (the decorator works even without the global guard registered):

- `GET /v1/healthz` — process liveness. Returns 200 unconditionally as long as Nest is responding.
- `GET /v1/readyz` — readiness. Uses Terminus' `PrismaHealthIndicator` (via `nestjs-prisma`'s exported helper or a thin custom check) plus a Redis ping. Returns 200 when both pass; 503 otherwise.

`health.controller.spec.ts` is a thin unit test that constructs the controller with mocked indicators and verifies the response shape. Real DB/Redis is exercised in sub-phase 6's integration tests.

---

## 7. Env config

`infra/config/env.schema.ts`:

```ts
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),                  // pooled connection
  DIRECT_URL: z.string().url().optional(),         // for migrations
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),         // optional in sub-phase 1
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),             // comma-separated
})
export type Env = z.infer<typeof envSchema>
```

`ConfigService` wraps `@nestjs/config` and exposes a typed `get<K>(key)` reading from the parsed schema. Failure to validate throws at boot — fail-fast.

`.env.example` documents every key with a comment describing its purpose. Local dev defaults (`postgres://rubik:rubik@localhost:5432/rubik`, `redis://localhost:6379`) are shipped as comments, not values.

---

## 8. Tests

Minimal at this stage — feature tests come with feature modules.

- `health.controller.spec.ts` — unit test with mocked indicators.
- `app.module.spec.ts` — instantiate `AppModule` in `Test.createTestingModule`, verify bootstrap doesn't throw. Catches DI wiring breaks early.

Both run under `vitest` via the package's `test` script. No Testcontainers yet (sub-phase 6).

---

## 9. Done when

- [ ] `pnpm --filter @rubik/api typecheck` clean.
- [ ] `pnpm --filter @rubik/api lint` clean.
- [ ] `pnpm --filter @rubik/api test` green.
- [ ] `make services.up && pnpm --filter @rubik/api dev` boots; `curl localhost:3001/v1/healthz` → 200; `curl localhost:3001/v1/readyz` → 200.
- [ ] With `OTEL_EXPORTER_OTLP_ENDPOINT` and `SENTRY_DSN` unset, no telemetry errors at boot.

## 10. Out of scope

- Any feature module other than health (sub-phases 2–5).
- Prisma schema (sub-phase 2). `PrismaService` is an empty shell that exports the Prisma client placeholder; readiness check uses a raw `SELECT 1`-style probe until a real model exists.
- OpenAPI emit (sub-phase 6).
- Dockerfile (sub-phase 6).

## 11. Commits

Two:

1. `feat(api): scaffold platform skeleton (plan 05 sub-phase 1)` — adds `apps/api/` and updates `pnpm-lock.yaml`.
2. (Optional) `chore(api): wire env-gated telemetry init` — split out only if the OTel/Sentry init code grows enough to deserve its own commit; otherwise bundle into 1.

Likely one commit only.
