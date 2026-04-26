# API sub-phase 4 — auth + users + me + global guard

**Plan:** [`05-apps-api.md`](2026-04-25-implementation/05-apps-api.md). Sub-phase 4 of plan 05.
**Master design refs:** §5.1 (endpoints), §18.2 (api tree), §18.3 (module organization), §18.4 (auth flow + cross-cutting), §21.2 (User + UserAlgorithm + RefreshToken).
**Predecessors:** sub-phase 1 (bootstrap), sub-phase 2 (Prisma + FTS), sub-phase 3 (catalog endpoints).
**Branch:** `plan-05-sub4-auth-me`.

## Problem & goal

Sub-phase 3 left the api with public catalog endpoints and a `JwtAuthGuard` that exists but is not wired (`TODO` marker on `apps/api/src/common/guards/jwt-auth.guard.ts`). The api cannot identify a caller, cannot mint or rotate tokens, and has no `/v1/me` surface. Plan 05's "Done when" specifically calls for: *"Auth flow round-trips: a valid Google ID token → app JWT pair → authenticated `/v1/me` call."*

Goal of this sub-phase: stand up `auth`, `users`, and `me` modules; wire `JwtAuthGuard` as global `APP_GUARD`; close the auth round-trip; ship the full `/v1/me/*` surface so the catalog plus personal-sheet halves of v1 are both reachable end-to-end.

## Decisions (from brainstorm)

1. **Token transport: tokens in JSON body.** `/v1/auth/google` and `/v1/auth/refresh` return `TokenPairSchema` (already in `@rubik/shared`). The api stays cookieless; the web (plan 07) owns the httpOnly cookie boundary via Auth.js v5.
2. **Refresh rotation: simple rotation.** On `/v1/auth/refresh`, validate → mint new pair → revoke old row. A replayed (already-revoked) refresh returns 401 `invalid_refresh_token`. No mass-revoke / theft-detection in v1.
3. **`/v1/me` scope: full.** GET `/v1/me`, GET `/v1/me/algorithms`, PUT `/v1/me/algorithms/:caseSlug`, DELETE `/v1/me/algorithms/:caseSlug`.
4. **Test surface: unit + manual smoke.** Vitest unit tests with mocked DI mirroring sub-phase 3; smoke checklist documented at the tail of this file. Testcontainers integration tests deferred to a dedicated infra sub-phase before plan 06.

## Architecture

### Module layout

```
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts            POST /v1/auth/{google,refresh,logout}
│   │   ├── auth.service.ts               loginWithGoogle, rotate, logout
│   │   ├── token.service.ts              sign + verify access/refresh JWTs
│   │   ├── google/
│   │   │   └── google-verifier.service.ts  google-auth-library wrapper (mocked seam)
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts           passport-jwt; reads JWT_ACCESS_SECRET
│   │   ├── exceptions.ts                 InvalidGoogleToken / InvalidRefreshToken / RefreshExpired
│   │   └── __tests__/
│   │       ├── auth.service.spec.ts
│   │       ├── token.service.spec.ts
│   │       └── google-verifier.service.spec.ts
│   ├── users/
│   │   ├── users.module.ts               exports UsersService
│   │   ├── users.service.ts              upsertFromGoogle, findById
│   │   └── __tests__/users.service.spec.ts
│   └── me/
│       ├── me.module.ts                  imports UsersModule
│       ├── me.controller.ts              GET /v1/me; GET/PUT/DELETE /v1/me/algorithms/:caseSlug
│       ├── me.service.ts                 user fetch + UserAlgorithm CRUD with slug→id resolution
│       ├── exceptions.ts                 ChosenVariantInvalidException (422)
│       └── __tests__/me.service.spec.ts
├── common/decorators/current-user.decorator.ts   reads req.user with strict typing
└── app.module.ts                                 imports AuthModule, UsersModule, MeModule;
                                                  registers APP_GUARD: JwtAuthGuard
```

### Dependency graph

```
AuthModule ──► UsersModule
   │
   └──► TokenService (in-module)
   └──► GoogleVerifierService (in-module)

MeModule ──► UsersModule

JwtStrategy is registered in AuthModule and consumed by JwtAuthGuard
(in common/, already exists). PassportModule.register({ defaultStrategy: 'jwt' })
lives in AuthModule with @Global() so the guard resolves the strategy app-wide.
```

No circular module imports. `infra/*` (`PrismaService`, `ConfigService`) injects anywhere as before.

### Global guard wiring

`app.module.ts` adds:

```ts
{ provide: APP_GUARD, useClass: JwtAuthGuard }
```

`JwtAuthGuard`'s `// TODO(ducbach, 2026-04-26): wire as APP_GUARD …` comment gets removed in the same commit. `@Public()` lands on:

- `HealthController` `/healthz` and `/readyz`
- `AuthController` all three handlers (`google`, `refresh`, `logout`)

Catalog endpoints already use `@PublicCacheable()` which composes `@Public()` — they remain reachable without changes.

## Data flow

### `POST /v1/auth/google` — first login or re-login

```
client → { idToken }
  → AuthController.google()
  → GoogleVerifierService.verify(idToken)        // calls google-auth-library
       ↳ throws InvalidGoogleTokenException (401, code invalid_google_token) on bad sig/aud/iss/exp
  → returns { sub, email, name, picture }
  → AuthService.loginWithGoogle(payload, { userAgent, ip })
       ↳ UsersService.upsertFromGoogle({ googleSub, email, displayName, avatarUrl })
            ↳ findUnique by googleSub; create-or-update; sets lastLoginAt = now
       ↳ TokenService.issuePair(user, { userAgent, ip })
            ↳ access JWT signed with JWT_ACCESS_SECRET, exp 15m
            ↳ refresh JWT signed with JWT_REFRESH_SECRET, exp 30d
            ↳ INSERT RefreshToken row { tokenHash: sha256(refresh), expiresAt, userAgent, ip }
       ↳ returns TokenPair { accessToken, refreshToken, expiresIn: 900 }
```

### `POST /v1/auth/refresh` — rotate

```
client → { refreshToken }
  → AuthController.refresh()
  → AuthService.rotate(refreshToken, { userAgent, ip })
       ↳ TokenService.verifyRefresh(token)        // verify signature + exp via JWT_REFRESH_SECRET
            ↳ throws InvalidRefreshTokenException (401, invalid_refresh_token) on bad sig
            ↳ throws RefreshExpiredException     (401, refresh_expired) on exp
       ↳ findUnique RefreshToken by tokenHash = sha256(token)
            ↳ row not found → InvalidRefreshTokenException
            ↳ row.revokedAt != null → InvalidRefreshTokenException (simple rotation, no mass-revoke)
       ↳ in $transaction:
            UPDATE RefreshToken SET revokedAt = now WHERE id = old.id
            INSERT new RefreshToken row
       ↳ returns new TokenPair
```

### `POST /v1/auth/logout`

```
client → { refreshToken }
  → AuthController.logout()
  → AuthService.logout(refreshToken)
       ↳ findUnique by tokenHash; if row exists and not revoked, set revokedAt = now
       ↳ idempotent: missing / already-revoked / bad-signature → still 204
  → 204 No Content
```

Logout is `@Public()`: it identifies the session by the refresh token, not the access JWT. Symmetric with `/v1/auth/refresh`.

### Authenticated request lifecycle (every other route)

```
client (Authorization: Bearer <access>)
  → ThrottlerGuard
  → JwtAuthGuard (APP_GUARD)
       ↳ @Public on handler? skip
       ↳ else: passport-jwt verifies signature + exp via JWT_ACCESS_SECRET
            ↳ JwtStrategy.validate({ sub, email }) returns { id: sub, email }   // no DB hit
       ↳ req.user populated; @CurrentUser() pulls it
  → ZodValidationPipe → Controller → Service → Prisma
```

### `GET /v1/me`

`MeService.getCurrent(userId)` → `prisma.user.findUniqueOrThrow({ where: { id: userId } })` → returns `UserSchema` shape (id, email, displayName, avatarUrl, createdAt as ISO string).

### `GET /v1/me/algorithms`

```ts
prisma.userAlgorithm.findMany({
  where: { userId },
  orderBy: { updatedAt: 'desc' },
})
```

Returns `UserAlgorithm[]` (per `@rubik/shared` `UserAlgorithmSchema`). No pagination, no filter — one user × at most 119 cases.

### `PUT /v1/me/algorithms/:caseSlug`

```
@CurrentUser() user, params { caseSlug }, body UpdateUserAlgorithm
  → MeService.upsertAlgorithm(user.id, caseSlug, body)
       ↳ algorithmCase.findFirst({ where: { slug: caseSlug }, select: { id: true } })
            ↳ null → CaseNotFoundException (already exists in catalog/exceptions.ts; 404)
       ↳ if body.chosenVariantId provided:
            algorithmVariant.findFirst({ where: { id: chosenVariantId, caseId } })
            ↳ null → ChosenVariantInvalidException (422, chosen_variant_invalid)
       ↳ userAlgorithm.upsert({
            where: { userId_caseId: { userId, caseId } },
            create: { userId, caseId, ...body },
            update: body,
         })
       ↳ returns UserAlgorithm
```

`UpdateUserAlgorithmSchema` (already in `@rubik/shared`) is partial — all three fields optional. Validation happens in `ZodValidationPipe` before the controller body. The variant-ownership check happens in the service so it can use the resolved `caseId`.

### `DELETE /v1/me/algorithms/:caseSlug`

```ts
const c = await prisma.algorithmCase.findFirst({ where: { slug: caseSlug }, select: { id: true } })
if (!c) throw new CaseNotFoundException(caseSlug)
try {
  await prisma.userAlgorithm.delete({ where: { userId_caseId: { userId, caseId: c.id } } })
} catch (err) {
  if (err.code !== 'P2025') throw err   // P2025 = record not found; idempotent delete
}
return // controller returns 204
```

Idempotent: deleting a non-existent row still returns 204.

## Errors

All exceptions extend `HttpException` with stable string codes (per `030-nestjs-rule.md` and `090-code-style-rule.md`):

| Exception | Status | Code | Where thrown |
|---|---|---|---|
| `InvalidGoogleTokenException` | 401 | `invalid_google_token` | `GoogleVerifierService` rejects sig/aud/iss/exp |
| `InvalidRefreshTokenException` | 401 | `invalid_refresh_token` | refresh row missing, hash mismatch, or revoked |
| `RefreshExpiredException` | 401 | `refresh_expired` | refresh JWT past exp |
| `ChosenVariantInvalidException` | 422 | `chosen_variant_invalid` | PUT `/me/algorithms/:caseSlug` with variant not on that case |
| `CaseNotFoundException` (reused) | 404 | `case_not_found` | slug→id lookup misses on me/algorithms |

`AllExceptionsFilter` already preserves `details` since fix `5e0a03f`. Exceptions that warrant payload context (e.g., `ChosenVariantInvalidException` carries `{ chosenVariantId, caseId }`) pass details into the constructor — surfaces in the response body under `error.details`.

## Configuration

**Env keys (already declared in `apps/api/src/infra/config/env.schema.ts`):**

- `JWT_ACCESS_SECRET` — required, min 32 chars
- `JWT_REFRESH_SECRET` — required, min 32 chars
- `GOOGLE_CLIENT_ID` — currently optional; this sub-phase tightens it to required when `NODE_ENV !== 'test'` via a `.refine()` clause so dev/prod fail fast and tests can omit it. Tests stub `GoogleVerifierService` at the seam, so they don't need a real client ID.

**TTL constants in code (per `090-code-style-rule.md` §magic-numbers):** declared near the top of `token.service.ts`.

```ts
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60                  // 900
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60       // 2,592,000
```

Used both for JWT signing (`expiresIn`) and the `expiresAt` column on the `RefreshToken` row.

## Security

- **Refresh tokens are SHA-256-hashed before persisting.** `RefreshToken.tokenHash` is `@unique`; raw is never stored. A leaked DB dump can't replay sessions.
- **Access JWTs are stateless.** No DB row, no per-request lookup. `JwtStrategy.validate({ sub, email })` returns `{ id: sub, email }` directly.
- **Refresh and access secrets are distinct env vars.** Cross-use is prevented at the signature layer.
- **`RefreshToken.userAgent` and `RefreshToken.ip` are captured on issue** for future audit / "active sessions" surface (out of scope this sub-phase).
- **Throttler:** `/v1/auth/*` gets `@Throttle({ default: { limit: 10, ttl: 60_000 }})` per §18.4. The existing global default (60/min/IP, 120/min/user) covers everything else.

## Testing

Per Q4 = B: unit tests + manual smoke checklist. No Testcontainers in this sub-phase.

### Unit tests (Vitest + `Test.createTestingModule` with mocked DI)

- **`users.service.spec.ts`** — `upsertFromGoogle`: creates new row when googleSub absent; updates email/displayName/avatarUrl + `lastLoginAt` when present; `findById` happy path.
- **`token.service.spec.ts`** — `issuePair` writes the SHA-256 hash, returns the raw token; `verifyRefresh` round-trips the same secret, rejects tampered signature, rejects expired (use `vi.useFakeTimers()` to advance past the exp).
- **`google-verifier.service.spec.ts`** — mocks `OAuth2Client.verifyIdToken`; happy path returns `{ sub, email, name, picture }`; throws `InvalidGoogleTokenException` on rejection from the library.
- **`auth.service.spec.ts`** — `loginWithGoogle` wires verifier→users→token (mocked); `rotate` revokes old row + writes new one in a transaction (assert via spy on `prisma.$transaction`); `rotate` on a revoked row throws `InvalidRefreshTokenException`; `logout` is idempotent across all three failure modes.
- **`me.service.spec.ts`** — `getCurrent` uses `findUniqueOrThrow`; `listAlgorithms` returns ordered by `updatedAt desc`; `upsertAlgorithm` resolves slug→id, validates variant ownership, calls upsert with the composite where; missing case → `CaseNotFoundException`; bad variant → `ChosenVariantInvalidException`; `deleteAlgorithm` swallows `P2025`.
- **`jwt.strategy.spec.ts`** — `validate({ sub, email })` returns `{ id: sub, email }`; no DB call.

### Manual smoke checklist (run post-merge)

The implementer runs these against `make dev.api` (Compose Postgres on port 5433) before closing the sub-phase. Step 4 generates a real Google ID token via [Google's OAuth Playground](https://developers.google.com/oauthplayground) — pick the `openid email profile` scope and "Exchange authorization code for tokens"; copy the `id_token`.

1. `make dev.api` boots clean; logs show `JwtAuthGuard` registered as APP_GUARD.
2. `curl http://localhost:3001/healthz` → 200 (verifies `@Public()` works after APP_GUARD wires).
3. `curl http://localhost:3001/v1/me` (no `Authorization`) → 401 with `{ error: { code: 'unauthorized', ... } }` (verifies guard fires by default).
4. `curl -X POST http://localhost:3001/v1/auth/google -H 'content-type: application/json' -d '{"idToken":"<from playground>"}'` → 200 with `{ accessToken, refreshToken, expiresIn: 900 }`.
5. `curl -H "Authorization: Bearer <access>" http://localhost:3001/v1/me` → 200 with the user shape.
6. `curl -X POST http://localhost:3001/v1/auth/refresh -H 'content-type: application/json' -d '{"refreshToken":"<from step 4>"}'` → 200 with new pair; **replay same refresh** → 401 `invalid_refresh_token`.
7. `curl -X POST http://localhost:3001/v1/auth/logout -H 'content-type: application/json' -d '{"refreshToken":"<latest>"}'` → 204; subsequent refresh with same token → 401.
8. (Post-plan-06 only — no `Case` rows exist yet.) `curl -H "Authorization: Bearer <access>" -X PUT http://localhost:3001/v1/me/algorithms/<slug> -H 'content-type: application/json' -d '{"status":"LEARNING"}'` → 200. Pre-seed it returns 404 `case_not_found` (still verifies the path resolution + auth gate worked).

If step 4's Google ID token is too friction-heavy in dev, the OAuth Playground can be re-used per session; do not introduce a dev-bypass env var in this sub-phase (would require an env schema change and a non-trivial branch in `GoogleVerifierService`). If the friction proves chronic, add it as a follow-up with its own design note.

## Done when

- [ ] `apps/api/src/modules/{auth,users,me}/` created and wired in `app.module.ts`
- [ ] `JwtAuthGuard` registered as `APP_GUARD`; TODO comment removed; `@Public()` on health + auth handlers
- [ ] `GoogleVerifierService`, `TokenService`, `AuthService`, `UsersService`, `MeService`, `JwtStrategy` implemented per data-flow spec
- [ ] `InvalidGoogleTokenException`, `InvalidRefreshTokenException`, `RefreshExpiredException`, `ChosenVariantInvalidException` defined with stable codes
- [ ] All six unit-test specs pass (`pnpm --filter @rubik/api test`)
- [ ] Smoke checklist 1–7 verified locally; step 8 documented as post-content-seed
- [ ] `pnpm typecheck && pnpm lint` clean
- [ ] Commits follow lowercase Conventional Commits with scopes `auth`, `api`, `shared` as appropriate

## Out of scope

- **Testcontainers integration tests** — punted to a dedicated infra sub-phase before plan 06 lands content
- **Theft-detection refresh rotation** (Q2 option B) — one-branch upgrade later if needed
- **Account suspension / deactivation** — not modeled in v1 schema (no `User.deactivatedAt`)
- **`/v1/me/algorithms` pagination or `?status=` filter** — YAGNI until plan 07 web actually wants it
- **Refresh-token row pruning cron** — deferred to plan 09 deployment work
- **Auth.js v5 (web side)** — plan 07
- **Swagger UI mount + `createZodDto` for the new DTOs** — already deferred to a later sub-phase (sub-phase 6 area)
- **PATCH `/v1/me`** for editing display name — not in §5.1; v2

## Forward-compat notes

- `JwtStrategy.validate` returns `{ id, email }` from claims; if v2 adds account suspension, switch to a DB-hit lookup at one site.
- `RefreshToken.userAgent` and `RefreshToken.ip` are captured on issue but not yet consumed; future "active sessions" endpoint reads them.
- `TokenService.issuePair` takes a `TokenPairContext = { userAgent?, ip? }` opts object so theft-detection rotation (Q2 B) lands without changing the call signature.
