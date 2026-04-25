# NestJS Conventions

`apps/api` is NestJS 11 + Express adapter + Prisma. Detailed structure in §18; this file pins the conventions that show up at every controller/service/module boundary.

## Module organization

- **One Nest module per top-level resource.** `AuthModule`, `UsersModule`, `CatalogModule` (with sub-modules `puzzles/`, `methods/`, `sets/`, `cases/`), `ScrambleModule`, `SearchModule`, `MeModule`, `HealthModule` (§18.2). Module boundary = REST resource boundary = directory boundary.
  - Why: predictable navigation. New endpoint → it's clear which module it lands in.
- **No circular module imports.** If two modules need to depend on each other, the shared concern belongs in a third module (or in `infra/`).
  - Why: NestJS DI handles cycles via `forwardRef` but the existence of one is a smell.
- **`infra/*` modules are global** (`@Global()` where appropriate): config, prisma, cache, logger, throttler, telemetry. Feature modules don't re-import them.
  - Why: cross-cutting infrastructure shouldn't pollute every feature module's `imports` list.
- **`common/*` has no DI scope.** Pure utilities: decorators, filters, guards, pipes, interceptors, generic DTOs.
  - Why: it's framework glue, not domain code. Treat it like a library.

## File naming

- **Files are kebab-case with role suffix:** `users.module.ts`, `users.controller.ts`, `users.service.ts`, `users.repository.ts`, `dto/google-login.dto.ts`, `strategies/jwt.strategy.ts`.
  - Why: matches NestJS official style; the suffix makes intent obvious from `find`/grep without opening the file.
- **Tests sit alongside the file under `__tests__/` or `*.spec.ts`** at the same level.
  - Why: closeness keeps the unit obvious; refactors move them together.

## Controller / service / repository

- **Layered: Controller → Service → (Repository) → Prisma.** Controllers shape HTTP, services hold domain logic, repositories abstract data access (§18.3).
- **Repository is optional.** Trivial CRUD reads call Prisma directly from the service. Add a repository only when there's reusable query logic, complex SQL, or tests need to mock the data layer.
  - Why: layering for its own sake adds a hop that doesn't earn its keep on a basic `findUnique`.
- **Controllers contain no business logic.** They translate HTTP ↔ service calls and apply guards/interceptors. Business rules live in the service.
  - Why: services are testable without bootstrapping HTTP; logic in controllers is tested twice or not at all.
- **Services are stateless.** No mutable instance fields beyond injected dependencies.
  - Why: NestJS providers are singletons by default; mutable state is a request-scoped landmine.

## DTOs and validation

- **DTOs are zod schemas from `packages/shared/schemas/`.** Use `nestjs-zod` to bridge them into NestJS pipes and `@nestjs/swagger`.
  - Why: same schema validates the api boundary AND types the web client (§20.3). One source of truth.
- **`ZodValidationPipe` is global** (registered on `APP_PIPE`). Don't add per-controller `ValidationPipe`.
  - Why: one consistent validation path; predictable error shape; no opt-out surprises.
- **Validation errors throw `ZodError` → caught by `AllExceptionsFilter` → returned as `{ error: { code: 'validation_error', details: [...] } }`** with HTTP 422.
  - Why: 422 is the unambiguous "well-formed but semantically invalid" signal; 400 conflates with malformed JSON.
- **Don't decorate DTOs with `class-validator` decorators.** zod is the validator.
  - Why: mixing the two is the worst-of-both: doubled types, doubled error paths.

## Authentication and authorization

- **Google OAuth handshake on web; api verifies the ID token.** Web POSTs the Google ID token to `/v1/auth/google`; `GoogleVerifierService` validates signature, `aud`, `iss`, `exp` via `google-auth-library`; `AuthService` upserts the user and mints `{access 15m, refresh 30d}` (§18.4).
  - Why: api is the source of truth; web carries no Google secrets.
- **`JwtAuthGuard` is global** (`APP_GUARD`). Routes opt out via `@Public()`.
  - Why: secure-by-default. A new endpoint is authenticated unless the author explicitly says otherwise.
- **`@CurrentUser()` decorator extracts the user from the request.** Don't read `req.user` directly in handlers.
  - Why: typed, testable, decoupled from the underlying auth strategy.
- **Refresh tokens stored as SHA-256 hash, never raw** (§21.2). Rotate on use. Revoke via `revokedAt`, don't delete.
  - Why: a leaked DB dump can't replay sessions; revocation history is auditable.

## Cross-cutting concerns

- **Global exception filter `AllExceptionsFilter`** returns `{ error: { code, message, details? }, requestId }`. Custom domain exceptions (`CaseNotFoundException`, `AlreadyLearnedException`) extend `HttpException` with stable error codes.
  - Why: stable codes are the public api contract; clients branch on `code`, not message text.
- **Logging via `nestjs-pino`** with a request ID per request (generated or read from `x-request-id`). `LoggingInterceptor` logs `method path status durationMs userId?` once per request.
  - Why: structured JSON, fast, request-correlation flows into Sentry breadcrumbs.
- **Caching via `@nestjs/cache-manager` + Redis** for marked GET endpoints. HTTP `Cache-Control: public, s-maxage=…` carries the heavy lifting at the CDN.
  - Why: two-layer (CDN + Redis) survives a CDN miss without going to Postgres.
- **Rate limit via `@nestjs/throttler` (Redis storage):** 60/min/IP public, 120/min/user authed, 10/min/IP on `/v1/auth/*` (§18.4).
  - Why: stateless rate limits across multiple machines need a shared counter store.
- **Health endpoints via `@nestjs/terminus`:** `/healthz` (process up), `/readyz` (Postgres + Redis pings).
  - Why: Fly.io health-check needs both — one for "is the process alive", one for "can it serve traffic".

## Telemetry

- **OpenTelemetry SDK initializes BEFORE NestJS bootstrap** in `main.ts`. Auto-instrumentation activates during DI.
  - Why: starting OTel after Nest causes the first requests to miss spans — debugging becomes guesswork.
- **Sentry initializes alongside OTel.** Errors and transactions go through both.
  - Why: OTel is for tracing/metrics; Sentry is for error UX (groupings, alerts). They're complementary.

## OpenAPI

- **Generated by `@nestjs/swagger` + `nestjs-zod` from controllers.** Swagger UI exposed at `/v1/docs` only when `NODE_ENV !== 'production'`.
  - Why: prod doesn't need a UI; the spec itself is emitted for the docs site to render.
- **`pnpm --filter @rubik/api openapi:emit`** writes `apps/api/openapi.json`. Run in CI before docs build.
  - Why: VitePress docs site renders the spec into a Markdown reference page (§17, §23.4).

## Versioning

- **URI versioning, default v1.** `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Every controller `@Controller({ path: '…', version: '1' })`.
  - Why: explicit versions in the URL keep clients pinned; v2 controllers can coexist when introduced.

## Testing

- **Unit tests for services** with mocked dependencies — fast, no DB.
- **Integration tests** in `apps/api/test/integration/` against a real Postgres via `testcontainers`. Each test runs in a transaction that rolls back.
  - Why: mocked Prisma drifts from real Prisma; integration tests catch query-shape and migration drift.
- **Contract tests** snapshot the OpenAPI spec. PRs that change the spec must update the snapshot intentionally.
  - Why: the spec is the public contract; silent shape changes break clients.
- **Don't test the framework.** No tests asserting "this controller has this decorator". Test behavior, not wiring.
  - Why: Nest's wiring is already tested upstream; restating it in our suite is dead code.
