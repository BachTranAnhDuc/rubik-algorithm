# Plan 07 sub-phase 7a — Implementation plan (web foundation + auth)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/web/` with Next.js 15 + Tailwind v4 + shadcn/ui + Auth.js v5; sign in with Google → handshake to api `/v1/auth/google` → display user from `/v1/me` on the landing page.

**Architecture:** Hand-authored scaffold (no interactive `create-next-app`), Tailwind v4 CSS-first config, shadcn/ui copy-in for primitives, Auth.js v5 JWT-strategy session that carries the api access token. `getCurrentUser()` server helper reads the session and calls api `/v1/me` with `Bearer <accessToken>`. Refresh-on-401 deferred to sub-phase 7c.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5 strict, Tailwind v4 (CSS-first via `@theme`), shadcn/ui, Auth.js v5 (`next-auth@5`), TanStack Query 5, zustand, React Hook Form, `next-themes`, lucide-react, sonner, `@rubik/shared` (zod schemas).

**Spec:** [`docs/plans/2026-04-25-web-sub-phase-7a-design.md`](2026-04-25-web-sub-phase-7a-design.md) (commit `5c54d25`)

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline -3`

Expected: branch `plan-07a-web-foundation`; latest commit is `5c54d25 docs(plans): add web sub-phase 7a design (foundation + auth)`.

- [ ] **Step 2: Confirm api dev server runs (we'll smoke-test against it later)**

Run: `pgrep -af "rubik/api" || echo "api not running"`. Either is fine — we don't need it now, but Task 14's smoke needs `make dev.api` later.

- [ ] **Step 3: Confirm `pnpm-workspace.yaml` covers `apps/*`**

Run: `grep -E "apps|packages" pnpm-workspace.yaml`

Expected: includes `apps/*` (and `packages/*`). The new `apps/web/` will be picked up automatically.

---

## Task 1: Scaffold the web package skeleton

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/eslint.config.js`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/.gitignore`

Hand-authored scaffold. We avoid `pnpm create next-app` because its prompts are interactive and a subagent can't drive them reliably. Scaffold first; install deps in Task 2.

- [ ] **Step 1.1: Create `apps/web/package.json`**

```json
{
  "name": "@rubik/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf .next node_modules/.cache"
  },
  "dependencies": {
    "@rubik/cube-core": "workspace:*",
    "@rubik/shared": "workspace:*",
    "@rubik/visualizer": "workspace:*"
  },
  "engines": {
    "node": ">=24"
  }
}
```

(Actual deps land in Task 2; this is the skeleton.)

- [ ] **Step 1.2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es2022"],
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowJs": false
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.3: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ['@rubik/visualizer', '@rubik/cube-core', '@rubik/shared'],
}

export default config
```

- [ ] **Step 1.4: Create `apps/web/eslint.config.js`**

```js
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]
```

- [ ] **Step 1.5: Create `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 1.6: Create `apps/web/.gitignore`**

```
# Next.js
.next/
out/
next-env.d.ts

# Build artifacts
dist/
build/

# Env (never commit; use .env.example)
.env
.env.local
.env.*.local
```

(Note: root `.gitignore` already covers `.next/`, but per-package `.gitignore` is helpful for clarity and future deploy contexts.)

- [ ] **Step 1.7: Verify `pnpm install` recognizes the workspace**

Run: `pnpm install --filter @rubik/web` from the repo root.

Expected: pnpm picks up the new package, but install fails because we haven't added Next.js itself yet. The expected error is `Cannot find module 'next'` or similar. That's fine — we install deps in Task 2.

If pnpm errors on the workspace itself (e.g., "package not found"), the workspace glob is wrong — investigate.

- [ ] **Step 1.8: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/eslint.config.js apps/web/postcss.config.mjs apps/web/.gitignore
git commit -m "$(cat <<'EOF'
feat(web): scaffold @rubik/web package skeleton

Hand-authored scaffold (no interactive create-next-app). Tailwind v4
postcss config, Next 15 with typedRoutes + transpilePackages for the
workspace deps, TS extends the root strict config + JSX preserve for
Next's bundler. ESLint flat config compat-extending next/core-web-vitals
+ next/typescript. Deps land in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Install dependencies

**Files:**
- Modify: `apps/web/package.json` (deps written by `pnpm add`)
- Modify: `pnpm-lock.yaml`

One install pass for everything 7a needs plus everything preinstalled for 7b-d so we don't churn the lockfile per sub-phase.

- [ ] **Step 2.1: Install runtime dependencies**

Run from the repo root:

```bash
pnpm --filter @rubik/web add \
  next@15 \
  react@19 \
  react-dom@19 \
  next-auth@5 \
  next-themes \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  zustand \
  react-hook-form \
  @hookform/resolvers \
  cmdk \
  sonner \
  lucide-react \
  react-markdown \
  remark-gfm \
  rehype-sanitize \
  dayjs \
  clsx \
  tailwind-merge \
  zod \
  class-variance-authority \
  tailwindcss-animate
```

- [ ] **Step 2.2: Install devDependencies**

```bash
pnpm --filter @rubik/web add -D \
  typescript \
  @types/node \
  @types/react \
  @types/react-dom \
  tailwindcss@4 \
  @tailwindcss/postcss@4 \
  eslint \
  eslint-config-next \
  @eslint/eslintrc \
  postcss
```

- [ ] **Step 2.3: Verify `pnpm install` resolves**

Run: `pnpm install` from the repo root.

Expected: clean exit, lockfile updated. If next-auth@5 (still in beta as of plan-write time) is unavailable, the pnpm error will name an alternate channel — switch to `next-auth@beta`.

- [ ] **Step 2.4: Verify the skeleton typechecks against newly-installed types**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean. (No source files yet beyond `next-env.d.ts` which Next will create on first dev run.)

The first `next dev` typically generates `next-env.d.ts`. We can pre-create it manually to avoid a "file not found" typecheck error:

```bash
echo '/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.' > apps/web/next-env.d.ts
```

(`next-env.d.ts` is gitignored — don't commit it. Next regenerates it on `dev`/`build`.)

- [ ] **Step 2.5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): install next 15 + react 19 + tailwind v4 + auth.js v5 + libs

Bulk install for sub-phase 7a plus everything preinstalled for 7b-d
(@tanstack/react-query, react-hook-form, zustand, cmdk, sonner,
react-markdown, dayjs, etc.) to avoid repeated lockfile churn.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tailwind v4 globals + lib helpers (cn, env)

**Files:**
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/lib/cn.ts`
- Create: `apps/web/src/lib/env.ts`

Tailwind v4 ships CSS-first via `@theme` per `020-styling-rule.md`. `cn()` is the standard `clsx + tailwind-merge` helper. `env.ts` zod-validates the runtime env at module load.

- [ ] **Step 3.1: Create `apps/web/src/app/globals.css`**

```css
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-card: oklch(0.205 0 0);
  --color-card-foreground: oklch(0.985 0 0);
  --color-popover: oklch(0.205 0 0);
  --color-popover-foreground: oklch(0.985 0 0);
  --color-primary: oklch(0.922 0 0);
  --color-primary-foreground: oklch(0.205 0 0);
  --color-secondary: oklch(0.269 0 0);
  --color-secondary-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.269 0 0);
  --color-muted-foreground: oklch(0.708 0 0);
  --color-accent: oklch(0.269 0 0);
  --color-accent-foreground: oklch(0.985 0 0);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-destructive-foreground: oklch(0.985 0 0);
  --color-border: oklch(1 0 0 / 0.1);
  --color-input: oklch(1 0 0 / 0.15);
  --color-ring: oklch(0.556 0 0);

  --radius-lg: 0.625rem;
  --radius-md: calc(0.625rem - 2px);
  --radius-sm: calc(0.625rem - 4px);

  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);
}

@media (prefers-color-scheme: light) {
  :root:not(.dark):not(.light) {
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.145 0 0);
    --color-card: oklch(1 0 0);
    --color-card-foreground: oklch(0.145 0 0);
    --color-popover: oklch(1 0 0);
    --color-popover-foreground: oklch(0.145 0 0);
    --color-primary: oklch(0.205 0 0);
    --color-primary-foreground: oklch(0.985 0 0);
    --color-secondary: oklch(0.97 0 0);
    --color-secondary-foreground: oklch(0.205 0 0);
    --color-muted: oklch(0.97 0 0);
    --color-muted-foreground: oklch(0.556 0 0);
    --color-accent: oklch(0.97 0 0);
    --color-accent-foreground: oklch(0.205 0 0);
    --color-border: oklch(0 0 0 / 0.1);
    --color-input: oklch(0 0 0 / 0.15);
    --color-ring: oklch(0.708 0 0);
  }
}

.light {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.145 0 0);
  --color-popover: oklch(1 0 0);
  --color-popover-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-secondary: oklch(0.97 0 0);
  --color-secondary-foreground: oklch(0.205 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.556 0 0);
  --color-accent: oklch(0.97 0 0);
  --color-accent-foreground: oklch(0.205 0 0);
  --color-border: oklch(0 0 0 / 0.1);
  --color-input: oklch(0 0 0 / 0.15);
  --color-ring: oklch(0.708 0 0);
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```

(Token values track shadcn/ui's slate baseline. The `.light` class plus the prefers-color-scheme media query give us system-by-default with a manual override that matches `next-themes`.)

- [ ] **Step 3.2: Create `apps/web/src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
```

- [ ] **Step 3.3: Create `apps/web/src/lib/env.ts`**

```ts
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
```

- [ ] **Step 3.4: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/lib/cn.ts apps/web/src/lib/env.ts
git commit -m "$(cat <<'EOF'
feat(web): add tailwind v4 globals + cn + env helpers

Tailwind v4 CSS-first @theme block with shadcn slate baseline tokens
and dark/light mode via .dark/.light class + prefers-color-scheme.
cn() is the standard clsx + tailwind-merge wrapper. env.ts zod-
validates server vs public env at module load with clear error output.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Provider tree (TanStack Query, theme, root)

**Files:**
- Create: `apps/web/src/providers/query-provider.tsx`
- Create: `apps/web/src/providers/theme-provider.tsx`
- Create: `apps/web/src/providers/root-providers.tsx`

`'use client'` for Query and Theme since both need the React context tree mounted on the client. Root composes them into a single export the layout uses.

- [ ] **Step 4.1: Create `apps/web/src/providers/query-provider.tsx`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

const STALE_TIME_MS = 60_000

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== 'production' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4.2: Create `apps/web/src/providers/theme-provider.tsx`**

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export const ThemeProvider = ({ children }: { children: ReactNode }) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    {children}
  </NextThemesProvider>
)
```

- [ ] **Step 4.3: Create `apps/web/src/providers/root-providers.tsx`**

```tsx
import type { ReactNode } from 'react'

import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

export const RootProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <QueryProvider>{children}</QueryProvider>
  </ThemeProvider>
)
```

(Composed without `'use client'` so it can be imported by the server-component root layout. Each leaf is the actual client component.)

- [ ] **Step 4.4: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/providers/
git commit -m "$(cat <<'EOF'
feat(web): add tanstack query + next-themes provider tree

QueryProvider with staleTime 60s + devtools in non-prod. ThemeProvider
backs next-themes (system default with .dark/.light class switching).
RootProviders composes them and is server-safe for the root layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: shadcn/ui init + Button component

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/components/ui/button.tsx`

We hand-author both files instead of running `pnpm dlx shadcn@latest init` (which is interactive). The Button copy-in matches shadcn's canonical implementation as of recent versions.

- [ ] **Step 5.1: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 5.2: Create `apps/web/src/components/ui/button.tsx`**

```tsx
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

(This file uses upstream shadcn `function`-style + `forwardRef` form. Per `090-code-style-rule.md` "Vendored components are the exception. Files under `apps/web/src/components/ui/` from `pnpm dlx shadcn@latest add` keep their upstream `function`-style — don't reshape them.")

- [ ] **Step 5.3: Install the missing radix dep**

`@radix-ui/react-slot` is needed by the Button's `asChild`:

```bash
pnpm --filter @rubik/web add @radix-ui/react-slot
```

- [ ] **Step 5.4: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/components.json apps/web/src/components/ui/button.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): add shadcn config + Button primitive

Hand-authored components.json (slate base, css vars, lucide icons,
@/lib/cn for cn()). Button copies the upstream shadcn implementation
verbatim — vendored-component exception per 090-code-style-rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `lib/api-client.ts`

**Files:**
- Create: `apps/web/src/lib/api-client.ts`

Thin fetch wrapper. Zod-parses success responses. Maps non-2xx to `ApiError`. Used by `getCurrentUser()` (Task 9) and downstream features.

- [ ] **Step 6.1: Create `apps/web/src/lib/api-client.ts`**

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
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string }
    }
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

- [ ] **Step 6.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "$(cat <<'EOF'
feat(web): add api-client fetch wrapper with zod parse

apiFetch parameterizes path + schema; takes optional accessToken to
build the Bearer header. Non-2xx → typed ApiError with status, code,
message extracted from the api's standard error envelope. NOT a
TanStack Query wrapper — Query lives in features that consume it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Auth.js v5 config + module augmentation + handler route

**Files:**
- Create: `apps/web/src/lib/auth/types.d.ts`
- Create: `apps/web/src/lib/auth/auth.config.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

Auth.js v5 NextAuthConfig. JWT strategy with module augmentation so we can carry `apiAccessToken` etc. on the session/token type-safely. The `[...nextauth]/route.ts` exports the GET/POST handlers.

`googleHandshake` is implemented in Task 8; this task references it ahead of time.

- [ ] **Step 7.1: Create `apps/web/src/lib/auth/types.d.ts`**

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

export {}
```

- [ ] **Step 7.2: Create `apps/web/src/lib/auth/auth.config.ts`**

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

import { serverEnv } from '../env'
import { googleHandshake } from './google-handshake'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: serverEnv.AUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: serverEnv.AUTH_GOOGLE_ID,
      clientSecret: serverEnv.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn: ({ account }) => {
      if (account?.provider !== 'google') return false
      if (!account.id_token) return false
      return true
    },
    jwt: async ({ token, account }) => {
      if (account?.provider === 'google' && account.id_token) {
        try {
          const pair = await googleHandshake(account.id_token)
          token.apiAccessToken = pair.accessToken
          token.apiRefreshToken = pair.refreshToken
          token.apiExpiresAt = Date.now() + pair.expiresIn * 1000
        } catch {
          return null
        }
      }
      return token
    },
    session: ({ session, token }) => {
      if (token) {
        session.apiAccessToken = token.apiAccessToken
        session.apiRefreshToken = token.apiRefreshToken
        session.apiExpiresAt = token.apiExpiresAt
      }
      return session
    },
  },
})
```

- [ ] **Step 7.3: Create `apps/web/src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth/auth.config'

export const { GET, POST } = handlers
```

(Auth.js v5 exports `handlers` as a single object containing both `GET` and `POST`. Destructure them at the route boundary.)

- [ ] **Step 7.4: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: FAIL — `googleHandshake` import resolves nothing because Task 8 hasn't created the file. That's OK; the typecheck will pass after Task 8.

(If we wanted to commit this independently, we'd stub `googleHandshake` here. Since Tasks 7 + 8 are tightly coupled, we'll commit them together at the end of Task 8.)

- [ ] **Step 7.5: Skip commit until Task 8 lands**

Hold the commit. Task 8 commits both Tasks 7 and 8.

---

## Task 8: `googleHandshake` helper

**Files:**
- Create: `apps/web/src/lib/auth/google-handshake.ts`

POSTs the Google id_token to api `/v1/auth/google` and returns the api token pair.

- [ ] **Step 8.1: Create `apps/web/src/lib/auth/google-handshake.ts`**

```ts
import 'server-only'

import { TokenPairSchema, type TokenPair } from '@rubik/shared'

import { apiFetch } from '../api-client'

export const googleHandshake = (idToken: string): Promise<TokenPair> =>
  apiFetch('/v1/auth/google', TokenPairSchema, {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
```

(`'server-only'` per §010 — this module should never be imported by client components.)

- [ ] **Step 8.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean now that both Task 7 + Task 8 files exist.

- [ ] **Step 8.3: Commit Tasks 7 + 8 together**

```bash
git add apps/web/src/lib/auth/types.d.ts apps/web/src/lib/auth/auth.config.ts apps/web/src/lib/auth/google-handshake.ts apps/web/src/app/api/auth/[...nextauth]/route.ts
git commit -m "$(cat <<'EOF'
feat(web): add auth.js v5 config + google handshake + handler route

NextAuth v5 with Google provider, JWT session strategy. signIn callback
gates on id_token presence; jwt callback POSTs to api /v1/auth/google
on initial sign-in and stores the api { accessToken, refreshToken,
expiresAt } on the session token. Module augmentation declares the
custom session/JWT fields type-safely. Refresh-on-401 deferred to 7c.

google-handshake is server-only and consumes the shared TokenPairSchema
via apiFetch — single source of truth for the wire shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `getCurrentUser` server helper

**Files:**
- Create: `apps/web/src/lib/auth/session.ts`

Reads the Auth.js session, fetches `/v1/me` with the api access token, returns the user or null. Never throws — landing page renders sign-in CTA on null.

- [ ] **Step 9.1: Create `apps/web/src/lib/auth/session.ts`**

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

- [ ] **Step 9.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/src/lib/auth/session.ts
git commit -m "$(cat <<'EOF'
feat(web): add getCurrentUser server helper

Reads the Auth.js session, fetches GET /v1/me with the stored api
access token, returns the parsed User or null. server-only fence per
§010. Catches fetch errors and returns null so the landing page can
render the sign-in CTA without an error boundary; 7d will add UX
for explicit auth-error states.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: SignInButton + SignOutButton client components

**Files:**
- Create: `apps/web/src/features/auth/sign-in-button.tsx`
- Create: `apps/web/src/features/auth/sign-out-button.tsx`

Client components that wrap shadcn Button + call `signIn('google')` / `signOut()`.

- [ ] **Step 10.1: Create `apps/web/src/features/auth/sign-in-button.tsx`**

```tsx
'use client'

import { signIn } from 'next-auth/react'

import { Button } from '@/components/ui/button'

interface SignInButtonProps {
  callbackUrl?: string
}

export const SignInButton = ({ callbackUrl = '/' }: SignInButtonProps) => (
  <Button onClick={() => signIn('google', { callbackUrl })}>Sign in with Google</Button>
)
```

- [ ] **Step 10.2: Create `apps/web/src/features/auth/sign-out-button.tsx`**

```tsx
'use client'

import { signOut } from 'next-auth/react'

import { Button } from '@/components/ui/button'

export const SignOutButton = () => (
  <Button variant="outline" onClick={() => signOut({ callbackUrl: '/' })}>
    Sign out
  </Button>
)
```

- [ ] **Step 10.3: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 10.4: Commit**

```bash
git add apps/web/src/features/auth/
git commit -m "$(cat <<'EOF'
feat(web): add sign-in + sign-out client buttons

Thin client components wrapping shadcn Button + Auth.js's signIn/
signOut. Callback URLs default to '/'; explicit prop on SignInButton
for routes that want to bounce back somewhere specific (e.g., a
'continue to /me/algorithms after login' flow in 7c).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `/login` route

**Files:**
- Create: `apps/web/src/app/login/page.tsx`

Simple page with the sign-in button. Server component (no hooks). Redirects to `/` if already signed in.

- [ ] **Step 11.1: Create `apps/web/src/app/login/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

import { SignInButton } from '@/features/auth/sign-in-button'
import { getCurrentUser } from '@/lib/auth/session'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Sign in to rubik-algorithm</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Sign in to track which algorithms you&apos;re learning, save your preferred variants, and
        sync your progress across devices.
      </p>
      <SignInButton />
    </main>
  )
}
```

- [ ] **Step 11.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 11.3: Commit**

```bash
git add apps/web/src/app/login/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /login route with google sign-in cta

Server component — calls getCurrentUser; if already signed in,
redirect to /. Otherwise render the sign-in button and explanatory
copy. Bare-bones styling; 7d can polish the marketing surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Root layout + landing page

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`

Root layout mounts the provider tree + sonner toaster. Landing page calls `getCurrentUser()`; renders welcome + sign-out OR sign-in CTA.

- [ ] **Step 12.1: Create `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

import { RootProviders } from '@/providers/root-providers'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'rubik-algorithm',
  description: 'A learnable, searchable, trackable algorithm corpus for the speedcubing community.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <RootProviders>
          {children}
          <Toaster richColors position="top-right" />
        </RootProviders>
      </body>
    </html>
  )
}
```

- [ ] **Step 12.2: Create `apps/web/src/app/page.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { SignInButton } from '@/features/auth/sign-in-button'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { getCurrentUser } from '@/lib/auth/session'

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">rubik-algorithm</h1>
      {user ? (
        <>
          <p className="text-xl">
            Welcome, <span className="font-semibold">{user.displayName ?? user.email}</span>
          </p>
          <SignOutButton />
        </>
      ) : (
        <>
          <p className="max-w-md text-center text-muted-foreground">
            The CFOP algorithm corpus, learnable and trackable.
          </p>
          <SignInButton />
          <Button variant="link" asChild>
            <a href="/login">Or visit /login directly</a>
          </Button>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 12.3: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`

Expected: clean.

- [ ] **Step 12.4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add root layout + landing page wired to /v1/me

Root layout mounts the provider tree + sonner toaster; uses
next/font/google for Inter + JetBrains Mono CSS-variable fonts per
§010. Landing page calls getCurrentUser server-side: signed-in users
see "Welcome ${name}" + sign-out, anonymous users see sign-in CTA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `.env.example` + production-build smoke

**Files:**
- Create: `apps/web/.env.example`

Document the required env vars. Then verify `pnpm build` succeeds — that's the strongest type-and-bundle gate.

- [ ] **Step 13.1: Create `apps/web/.env.example`**

```
# Auth.js v5
AUTH_SECRET=run-`openssl rand -base64 32`-and-paste-here
AUTH_GOOGLE_ID=your-web-app-google-oauth-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-web-app-google-oauth-client-secret

# API URLs
# Server-side fetches go here. In prod can be the Fly internal hostname.
API_URL=http://localhost:3001
# Client-side fetches go here.
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 13.2: Set up a local `.env` for the build smoke**

Build needs env vars even if it doesn't actually call out. Quick local `.env` (NOT committed):

```bash
cat > apps/web/.env <<'EOF'
AUTH_SECRET=development-secret-please-rotate-me-at-least-32-chars
AUTH_GOOGLE_ID=dev-placeholder.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=dev-placeholder-secret
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
```

- [ ] **Step 13.3: Run typecheck + lint + build**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
pnpm --filter @rubik/web build
```

Expected: all clean. The `build` is the most thorough gate — typechecks server + client trees + emits the optimized bundle.

If build fails on env validation (e.g., the page actually evaluates `serverEnv` at module load and the dev-secret is invalid), the values above must be tweaked to satisfy the zod schema.

- [ ] **Step 13.4: Commit**

```bash
git add apps/web/.env.example
git commit -m "$(cat <<'EOF'
feat(web): add .env.example documenting auth + api urls

AUTH_SECRET (Auth.js JWT encryption), AUTH_GOOGLE_ID/SECRET (web's
Google OAuth client — separate from the api's GOOGLE_CLIENT_ID),
and API_URL/NEXT_PUBLIC_API_URL (server vs client base URLs;
identical locally, can split in prod).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Manual smoke verification (no commit)

Validates the auth round-trip end-to-end against a running api with seeded data. Requires:
- Compose Postgres on 5433 (already up)
- Api running on `:3001` (run `make dev.api` in another terminal)
- A real Google OAuth web app client ID + secret in `apps/web/.env`

- [ ] **Step 14.1: Boot api**

In a separate terminal:

```bash
make dev.api
```

Wait for the "Nest application successfully started" log line.

- [ ] **Step 14.2: Boot web**

```bash
pnpm --filter @rubik/web dev
```

Expected: Next.js starts on :3000.

- [ ] **Step 14.3: Visit `http://localhost:3000`**

Expected: landing page with the rubik-algorithm heading + sign-in CTA. Tailwind styling visible (centered layout, themed colors).

- [ ] **Step 14.4: Click "Sign in with Google"**

Expected: redirect to Google OAuth. Complete consent.

- [ ] **Step 14.5: Land back on `/`**

Expected: page now shows "Welcome ${name}" with the user's display name from Google + a sign-out button.

In the api log, confirm a `POST /v1/auth/google` 200 followed by a `GET /v1/me` 200 (the second from the page render).

- [ ] **Step 14.6: Refresh `/`**

Expected: name still rendered. The Auth.js cookie persists.

- [ ] **Step 14.7: Click "Sign out"**

Expected: name gone, sign-in CTA visible.

In the api log, no logout call yet (logout-api integration is 7d's scope; 7a's signOut just clears the Auth.js cookie).

- [ ] **Step 14.8: Visit `http://localhost:3000/login` while signed out**

Expected: login page renders with sign-in CTA.

- [ ] **Step 14.9: Sign in via `/login`**

Expected: same flow → redirected to `/`.

- [ ] **Step 14.10: Visit `/login` while signed in**

Expected: redirect to `/` (the page's own redirect logic in Task 11).

- [ ] **Step 14.11: Stop both servers**

Ctrl-C the dev processes.

If any step fails: do not close the sub-phase. Fix and re-test.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

Run: `git log --oneline 5c54d25..HEAD`

Expected (newest first):
```
<hash> feat(web): add .env.example documenting auth + api urls
<hash> feat(web): add root layout + landing page wired to /v1/me
<hash> feat(web): add /login route with google sign-in cta
<hash> feat(web): add sign-in + sign-out client buttons
<hash> feat(web): add getCurrentUser server helper
<hash> feat(web): add auth.js v5 config + google handshake + handler route
<hash> feat(web): add api-client fetch wrapper with zod parse
<hash> feat(web): add shadcn config + Button primitive
<hash> feat(web): add tanstack query + next-themes provider tree
<hash> feat(web): add tailwind v4 globals + cn + env helpers
<hash> feat(web): install next 15 + react 19 + tailwind v4 + auth.js v5 + libs
<hash> feat(web): scaffold @rubik/web package skeleton
```

- [ ] **Step F.2: Confirm full quality gates**

Run from the repo root:

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
pnpm --filter @rubik/web build
```

Expected: all green.

- [ ] **Step F.3: Done-when checklist (paste into PR description)**

```
- [x] apps/web/ exists with the scaffold + Auth.js + landing page
- [x] pnpm install resolves all web deps including workspace packages
- [x] pnpm --filter @rubik/web typecheck && lint && build clean
- [x] Smoke gate 14.1-14.10 verified locally with a real Google OAuth client
- [x] make dev.web starts the dev server (Makefile already targets pnpm dev)
- [x] Auth.js v5 module augmentation declares custom session fields type-safely
- [x] Commits follow lowercase Conventional Commits with scope `web`
```

---

## Out of scope (do not implement)

- All catalog routes — 7b
- All /me/* routes — 7c
- Refresh-on-401 logic — 7c
- /search + ⌘K palette — 7c
- /timer — 7d
- Embed iframe — 7d
- SEO (sitemap, robots, JSON-LD HowTo, opengraph-image) — 7d
- Sentry instrumentation — 7d
- Storybook — 7d
- Playwright e2e — 7d
- Lighthouse budget tuning — 7d
- Dark/light toggle UI — 7d (next-themes is wired, but no toggle component yet)
- 3D Visualizer integration — gated on plan 04b
- vitest config + component tests — defer to 7b when there's something worth testing
