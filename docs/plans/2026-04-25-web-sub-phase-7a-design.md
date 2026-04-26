# Plan 07 sub-phase 7a — web foundation + auth

**Plan:** [`07-apps-web.md`](2026-04-25-implementation/07-apps-web.md). Sub-phase 7a — first of four (7a foundation+auth, 7b catalog, 7c /me+search, 7d closing).
**Master design refs:** §19 (full web), §19.1 (libraries), §19.4 (auth), §18.4 (api auth flow), §020 (styling), §010 (React patterns).
**Predecessors:** all of plans 02-06 + 04a + 05a on main. Api running locally on :3001 with seeded content.
**Branch:** `plan-07a-web-foundation`.

## Problem & goal

Plan 07 is the entire web app — multi-week scope across 15 numbered steps. Decomposed into four sub-phases (7a-d). This doc covers 7a — the foundation: scaffold + libs + provider tree + Auth.js v5 + Google OAuth → api JWT round-trip + landing page that displays the signed-in user.

Goal: visit `localhost:3000`, click "Sign in", complete Google OAuth, see "Welcome &lt;name&gt;" rendered from a `GET /v1/me` round-trip. Refresh persists. Sign out clears. Lighthouse and bundle work isn't 7a's concern; foundational plumbing is.

## Decisions (from brainstorm)

1. **Decompose plan 07 into 7a-d.** This doc is 7a only.
2. **Smoke = signed-in landing.** Closes the auth round-trip end-to-end on first ship; everything else (catalog, /me, search, timer, SEO, e2e) is deferred to 7b-d.
3. **Auth.js v5 with JWT session strategy.** The Auth.js session cookie carries the api `accessToken` as a custom property. Read via `getCurrentUser()` server helper that adds `Authorization: Bearer …` to api fetches.
4. **Refresh-on-401 deferred to 7c.** 7a accepts the 15-minute access token TTL; user re-signs-in if expired. /me/algorithms (7c) is the first surface that mutates and warrants the refresh logic.
5. **Theme:** `next-themes` system-default with persisted user override. `<html className={dark}>` switching matches §020 ("Mode lives on `<html class="dark">`").
6. **shadcn baseline:** slate + CSS variables + lucide. Only `Button` installed in 7a; more added per-task in later sub-phases.
7. **TanStack Query global default `staleTime: 60_000`.** 7a uses Query only via the `getCurrentUser()` server helper (no client-side queries yet).
8. **No Storybook, no Playwright in 7a.** Storybook scaffolding lands in 7d; e2e tests land in 7d.

## Architecture

### File layout

```
apps/web/
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx                root layout — providers + sonner toaster + html classname
│   │   ├── page.tsx                  landing — sign-in CTA or "Welcome ${name}"
│   │   ├── login/page.tsx            login route — calls signIn('google')
│   │   ├── api/auth/[...nextauth]/route.ts   Auth.js v5 GET + POST handlers
│   │   ├── globals.css               Tailwind v4 @theme block + dark/light tokens
│   │   └── favicon.ico               Next.js scaffold default
│   ├── components/ui/                shadcn copy-ins (Button only in 7a)
│   ├── lib/
│   │   ├── cn.ts                     clsx + tailwind-merge helper
│   │   ├── env.ts                    zod-validated public + server env
│   │   ├── api-client.ts             fetch wrapper + zod parse + 401 mapping
│   │   └── auth/
│   │       ├── auth.config.ts        Auth.js v5 NextAuthConfig
│   │       ├── google-handshake.ts   POSTs id_token → api /v1/auth/google
│   │       └── session.ts            getCurrentUser() server helper
│   ├── features/auth/
│   │   ├── sign-in-button.tsx        client component
│   │   └── sign-out-button.tsx       client component
│   └── providers/
│       ├── query-provider.tsx        TanStack Query + HydrationBoundary
│       ├── theme-provider.tsx        next-themes (system default)
│       └── root-providers.tsx        composed root provider
├── .env.example                      AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, NEXT_PUBLIC_API_URL
├── components.json                   shadcn config
├── next.config.ts                    typedRoutes: true, transpilePackages: ['@rubik/visualizer']
├── tsconfig.json                     extends ../../tsconfig.json + jsx: preserve + paths {"@/*": ["./src/*"]}
├── package.json                      "name": "@rubik/web", scripts {dev, build, start, lint, typecheck, test, clean}
├── eslint.config.js                  flat config extending the root + Next plugin
└── vitest.config.ts                  empty for 7a (component tests land 7b+)
```

`features/` directory follows the §19.2 file structure. 7a only seeds `auth/`; catalog/me/search/timer features land in 7b-d.

### Dependency direction

Per §050 + §19.1, the web app pulls:

**Workspace packages:** `@rubik/shared`, `@rubik/cube-core`, `@rubik/visualizer` (latter two installed but unused in 7a — preinstalling to avoid an install round-trip in 7b).

**Framework + UI:** `next@15`, `react@19`, `react-dom@19`, `tailwindcss@4`, `clsx`, `tailwind-merge`, `lucide-react`.

**State + data:** `@tanstack/react-query@5`, `@tanstack/react-query-devtools`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod` (transitive via shared).

**Auth:** `next-auth@5` (a.k.a. Auth.js v5). Beta or stable depending on what's the recommended channel at install time.

**Theming:** `next-themes`.

**UI primitives:** `cmdk` (preinstalled, used in 7c), `sonner` (toaster mounted in root layout).

**Server-side observability:** Sentry, pino — **deferred to 7d**, not in 7a.

**Markdown:** `react-markdown`, `remark-gfm`, `rehype-sanitize` — preinstalled but used by 7b's case page.

### `lib/env.ts`

Zod-validated env. Splits public (NEXT_PUBLIC_*) from server-only.

```ts
import { z } from 'zod'

const serverSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  API_URL: z.string().url(),                 // server-side fetches go here
})

const publicSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),     // client-side fetches go here
})

export const serverEnv = serverSchema.parse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  API_URL: process.env.API_URL,
})

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})
```

`API_URL` and `NEXT_PUBLIC_API_URL` will both point to `http://localhost:3001` locally; in prod the public one points at the public api host while the server-side one can short-circuit through Fly's internal networking.

### `lib/api-client.ts`

Thin fetch wrapper. Zod-parses response on success. Maps non-2xx to typed `ApiError`. NOT a TanStack Query wrapper.

```ts
import type { ZodType } from 'zod'

import { publicEnv, serverEnv } from './env'

export interface ApiError {
  status: number
  code?: string
  message: string
}

const isServer = typeof window === 'undefined'

const baseUrl = (): string => (isServer ? serverEnv.API_URL : publicEnv.NEXT_PUBLIC_API_URL)

export const apiFetch = async <T>(
  path: string,
  schema: ZodType<T>,
  init?: RequestInit & { accessToken?: string },
): Promise<T> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.accessToken ? { authorization: `Bearer ${init.accessToken}` } : {}),
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
    const err: ApiError = {
      status: res.status,
      code: body?.error?.code,
      message: body?.error?.message ?? res.statusText,
    }
    throw err
  }
  return schema.parse(await res.json())
}
```

### Auth flow

```
client (browser)
  │  click "Sign in"
  ▼
signIn('google') from features/auth/sign-in-button.tsx
  │
  ▼  Google OAuth consent
google
  │  id_token + access_token + profile
  ▼
Auth.js callbacks.signIn(...) at /api/auth/[...nextauth]/route.ts
  │  POST { idToken } to ${API_URL}/v1/auth/google     google-handshake.ts
  ▼
api (running on :3001)
  │  verify, upsert user, mint { accessToken, refreshToken, expiresIn }
  ▼  TokenPair JSON
Auth.js callbacks.jwt:
  │  if (account?.provider === 'google') {
  │    token.apiAccessToken  = pair.accessToken
  │    token.apiRefreshToken = pair.refreshToken
  │    token.apiExpiresAt    = Date.now() + pair.expiresIn * 1000
  │  }
  ▼  Auth.js encrypts the token (AUTH_SECRET) into a session cookie
client
  │  redirect to /
  ▼
landing page (Server Component)
  │  await getCurrentUser()
  │     ↳ session = await auth()         Auth.js v5 helper
  │     ↳ if (!session?.apiAccessToken) return null
  │     ↳ user = await apiFetch('/v1/me', UserSchema, { accessToken: session.apiAccessToken })
  │     ↳ return user
  ▼
"Welcome ${name}" or sign-in CTA
```

The api access token TTL is 15 minutes. After expiry, the next `/v1/me` fetch returns 401 — `getCurrentUser()` throws an `ApiError`. 7a accepts this; user re-signs-in. 7c adds a refresh route that catches 401, calls `/v1/auth/refresh` with the stored refresh token, updates the Auth.js session cookie, and retries the original request.

`signOut()` clears the Auth.js cookie. The api refresh token row in the DB remains valid until 30d expiry (orphaned but harmless; cleanup cron is plan 09 territory). 7d will add `signOut` calling `/v1/auth/logout` on the api side too. For 7a, just clearing the cookie is acceptable.

### `lib/auth/session.ts`

```ts
import 'server-only'

import { UserSchema, type User } from '@rubik/shared'

import { apiFetch } from '../api-client'
import { auth } from './auth.config'

export const getCurrentUser = async (): Promise<User | null> => {
  const session = await auth()
  if (!session?.apiAccessToken) return null
  try {
    return await apiFetch('/v1/me', UserSchema, { accessToken: session.apiAccessToken })
  } catch {
    return null
  }
}
```

`'server-only'` import fence per §010 ("Server-only modules fence with `import 'server-only';`. … catches accidental client imports as build errors").

### `lib/auth/auth.config.ts`

Auth.js v5 NextAuthConfig wiring Google + the api-handshake JWT callback. Lives in a TS file (not JS) so module augmentation for the session token shape is type-safe.

Key points:
- `providers: [Google({ clientId: serverEnv.AUTH_GOOGLE_ID, clientSecret: serverEnv.AUTH_GOOGLE_SECRET })]`
- `session: { strategy: 'jwt' }`
- `secret: serverEnv.AUTH_SECRET`
- `callbacks.signIn`: returns `false` if api handshake fails (Auth.js shows error page)
- `callbacks.jwt`: on first signIn, calls `googleHandshake(account.id_token)` and stores `{ apiAccessToken, apiRefreshToken, apiExpiresAt }` on the token
- `callbacks.session`: exposes `apiAccessToken` to the session object

Module augmentation in a co-located `.d.ts`:

```ts
declare module 'next-auth' {
  interface Session {
    apiAccessToken?: string
    apiRefreshToken?: string
    apiExpiresAt?: number
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    apiAccessToken?: string
    apiRefreshToken?: string
    apiExpiresAt?: number
  }
}
```

## Errors

- Auth.js handler errors (Google OAuth fail, signIn callback returns false) → Auth.js's default error page with redirect to `/login?error=...`. 7a doesn't customize the error UI; 7d can.
- `getCurrentUser()` returns `null` on any failure — landing page renders sign-in CTA. The page never throws.
- `apiFetch` throws `ApiError`. Server Components that don't catch will hit Next.js's error boundary; 7a relies on the default error.tsx.

## Configuration

`apps/web/.env.example`:

```
# Server-only
AUTH_SECRET=<openssl rand -base64 32>
AUTH_GOOGLE_ID=<from Google Cloud Console — Web app client ID, NOT the api's>
AUTH_GOOGLE_SECRET=<from Google Cloud Console>
API_URL=http://localhost:3001

# Public
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Important: the web's `AUTH_GOOGLE_ID` is a **separate Google OAuth client** from the api's `GOOGLE_CLIENT_ID`. The api verifies id tokens (any audience matching `GOOGLE_CLIENT_ID`); the web app initiates OAuth (needs its own client_id + client_secret). They can be the same Google project but must be separate "OAuth 2.0 Client IDs" in the Cloud Console.

## Smoke gate

1. `make dev.web` boots cleanly on `:3000` (assumes Make target lands in 7a; today the target invokes `pnpm --filter @rubik/web dev`).
2. Landing renders with Tailwind styling visible.
3. `/login` redirects to Google OAuth.
4. After Google consent, lands back on `/` showing "Welcome ${name}".
5. Refresh `/` → name still rendered.
6. Click "Sign out" → name gone, sign-in CTA visible.
7. `pnpm --filter @rubik/web typecheck && pnpm --filter @rubik/web lint && pnpm --filter @rubik/web build` clean.

## Done when

- [ ] `apps/web/` directory exists with the files above
- [ ] `pnpm install` from repo root resolves all web deps including workspace packages
- [ ] `pnpm --filter @rubik/web typecheck && lint && build` clean
- [ ] Smoke gate 1-6 verified locally with a real Google OAuth client
- [ ] `make dev.web` starts the dev server (Makefile already targets `pnpm --filter @rubik/web dev`)
- [ ] Auth.js v5 module augmentation declares the custom session fields type-safely
- [ ] Commits follow lowercase Conventional Commits with scope `web`

## Out of scope (deferred)

- All catalog routes — 7b
- All /me/* routes (including the personal sheet) — 7c
- Refresh-on-401 logic in `apiFetch` / Auth.js JWT callback — 7c
- /search + ⌘K palette — 7c
- /timer — 7d
- Embed iframe — 7d
- SEO (sitemap, robots, JSON-LD HowTo, opengraph-image) — 7d
- Sentry instrumentation — 7d
- Storybook — 7d
- Playwright e2e — 7d
- Lighthouse budget tuning — 7d
- Dark/light toggle UI component — 7d (`next-themes` is wired, but no toggle yet)
- 3D Visualizer integration — gated on plan 04b

## Forward-compat notes

- The `apiFetch` shape will not change between 7a and 7c. Refresh handling is internal to `auth.config.ts`'s `jwt` callback (which can detect `Date.now() >= token.apiExpiresAt` and call `/v1/auth/refresh` synchronously).
- `getCurrentUser()`'s `null`-returns-on-error contract is stable; if an error UX surfaces in 7d, that's a layer above (a custom error.tsx).
- The `features/` shape (one folder per domain) extends naturally for `features/catalog`, `features/me`, etc. in later sub-phases.
- `components/ui/` only has `Button` in 7a; later sub-phases run `pnpm dlx shadcn@latest add <name>` for each component as it's needed (Form, Input, Table, Dialog, etc.).
