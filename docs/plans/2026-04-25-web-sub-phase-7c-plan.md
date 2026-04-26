# Web Sub-Phase 7c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the discovery + tracking surface (`/search`, ⌘K palette, `/me/algorithms`, case-page "Track this case") onto the catalog that shipped in 7b, with proactive Auth.js v5 token rotation.

**Architecture:** Four orthogonal slices — auth (refresh + logout), search (RSC + client input), command palette (cmdk + Zustand toggle), and `/me` (auth-gated layout + table + mutations). All client mutations go through TanStack Query with optimistic updates; the case-page CTA reuses the `/me` mutations. Refresh logic lives entirely in the Auth.js `jwt` callback so RSC code paths stay simple.

**Tech Stack:** Next.js 15 + React 19 + Auth.js v5 + cmdk + Zustand + TanStack Query 5 + sonner toasts + shadcn `dialog`/`command`/`select`/`table` primitives.

---

## Pre-flight (orchestrator runs directly, no commit)

- [ ] **Step 0.1: Confirm branch state**

```bash
git status                                # working tree clean, on plan-07c-web-search-me
git log --oneline -3
```

Expected: HEAD at `4e2d32f docs(plans): add web sub-phase 7c design`, branched from `4310d6c` (sub-phase 7b merge).

- [ ] **Step 0.2: Confirm api is up + seeded**

```bash
curl -s http://localhost:3001/v1/puzzles | jq -c '.[] | {slug}'
curl -s "http://localhost:3001/v1/search?q=t-perm" | jq -c '.hits[0]'
```

Expected: one puzzle (`{"slug":"3x3"}`) and one hit with `caseSlug: "t-perm"`. If the api isn't running, start it: `pnpm --filter @rubik/api dev`.

- [ ] **Step 0.3: Confirm dependencies are installed**

```bash
grep -E '"(cmdk|zustand|sonner|next-themes|lucide-react)"' apps/web/package.json
```

Expected: all five present. If missing, `pnpm --filter @rubik/web install` from the lockfile.

---

## Task 1: shadcn primitives (dialog, command, select, table)

7c relies on four shadcn components not yet vendored. They land in `apps/web/src/components/ui/` and are owned-source from this point forward.

**Files:**
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/command.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/table.tsx`

- [ ] **Step 1.1: Vendor the components via shadcn CLI**

Run from repo root:

```bash
pnpm --filter @rubik/web exec shadcn@latest add dialog command select table -y
```

Expected: four files in `apps/web/src/components/ui/`, plus `@radix-ui/react-dialog`, `@radix-ui/react-select`, and any peer deps appear in `apps/web/package.json`. The CLI consults `apps/web/components.json` (already configured in 7a).

- [ ] **Step 1.2: Verify the import surface**

```bash
ls apps/web/src/components/ui/
grep -l "Dialog\|Command\|Select\|Table" apps/web/src/components/ui/*.tsx
```

Expected: `button.tsx`, `command.tsx`, `dialog.tsx`, `select.tsx`, `table.tsx`. Each exports the named primitives we'll consume in later tasks (e.g., `Dialog`, `DialogContent`, `Command`, `CommandInput`, `CommandList`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`).

- [ ] **Step 1.3: Verify build still passes**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green on both. shadcn-vendored files use `function` declarations (not arrow functions) per project rule `090-code-style-rule.md` "Vendored components are the exception."

- [ ] **Step 1.4: Commit**

```bash
git add apps/web/src/components/ui/ apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(web): vendor shadcn dialog, command, select, table primitives

Required for sub-phase 7c — command palette, /me/algorithms table,
and the track-case status select.
EOF
)"
```

---

## Task 2: server-only refresh helper

The Auth.js `jwt` callback needs a way to call `/v1/auth/refresh`. Keep it server-only and validated by the shared schema.

**Files:**
- Create: `apps/web/src/lib/auth/refresh.ts`

- [ ] **Step 2.1: Write the helper**

```ts
import 'server-only'

import { TokenPairSchema, type TokenPair } from '@rubik/shared'

import { publicEnv } from '../env.client'

export const refreshApiTokens = async (refreshToken: string): Promise<TokenPair> => {
  const res = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`refresh failed: ${res.status}`)
  }
  return TokenPairSchema.parse(await res.json())
}
```

- [ ] **Step 2.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/src/lib/auth/refresh.ts
git commit -m "feat(web): add server-only refreshApiTokens helper"
```

---

## Task 3: proactive token rotation in jwt callback

Extend the Auth.js v5 `jwt` callback to rotate when `apiExpiresAt - now < 60s`. Returning `null` from the callback clears the session, which is the v5-idiomatic way to force re-login.

**Files:**
- Modify: `apps/web/src/lib/auth/auth.config.ts`

- [ ] **Step 3.1: Replace the jwt callback**

Open `apps/web/src/lib/auth/auth.config.ts` and replace lines 22-34 (the existing `jwt` callback) with:

```ts
    jwt: async ({ token, account }) => {
      if (account?.provider === 'google' && account.id_token) {
        try {
          const pair = await googleHandshake(account.id_token)
          token.apiAccessToken = pair.accessToken
          token.apiRefreshToken = pair.refreshToken
          token.apiExpiresAt = Date.now() + pair.expiresIn * 1000
          return token
        } catch {
          return null
        }
      }
      if (token.apiAccessToken && token.apiRefreshToken && token.apiExpiresAt) {
        const SKEW_MS = 60_000
        if (token.apiExpiresAt - Date.now() < SKEW_MS) {
          try {
            const pair = await refreshApiTokens(token.apiRefreshToken)
            token.apiAccessToken = pair.accessToken
            token.apiRefreshToken = pair.refreshToken
            token.apiExpiresAt = Date.now() + pair.expiresIn * 1000
          } catch {
            return null
          }
        }
      }
      return token
    },
```

Add the import beside the existing `googleHandshake` import:

```ts
import { refreshApiTokens } from './refresh'
```

- [ ] **Step 3.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green. The `Token` augmentation in `lib/auth/types.d.ts` already declares `apiAccessToken`, `apiRefreshToken`, and `apiExpiresAt` (added in 7a).

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/src/lib/auth/auth.config.ts
git commit -m "feat(web): proactively rotate api tokens in auth.js jwt callback"
```

---

## Task 4: revoke refresh token on sign-out

Replace the client-side `signOut()` with a server-action wrapper that POSTs `/v1/auth/logout` (revokes the refresh token server-side) before clearing the Auth.js session.

**Files:**
- Create: `apps/web/src/features/auth/sign-out-action.ts`
- Modify: `apps/web/src/features/auth/sign-out-button.tsx`

- [ ] **Step 4.1: Create the server action**

```ts
'use server'

import { auth, signOut as authSignOut } from '@/lib/auth/auth.config'
import { publicEnv } from '@/lib/env.client'

export const serverSignOut = async (): Promise<void> => {
  const session = await auth()
  if (session?.apiRefreshToken) {
    try {
      await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.apiRefreshToken }),
        cache: 'no-store',
      })
    } catch {
      /* idempotent — token revocation is best-effort */
    }
  }
  await authSignOut({ redirectTo: '/' })
}
```

- [ ] **Step 4.2: Rewrite the button to invoke the action via form**

Replace the entire contents of `apps/web/src/features/auth/sign-out-button.tsx` with:

```tsx
import { Button } from '@/components/ui/button'

import { serverSignOut } from './sign-out-action'

export const SignOutButton = () => (
  <form action={serverSignOut}>
    <Button variant="outline" type="submit">
      Sign out
    </Button>
  </form>
)
```

The component is now a Server Component (no `'use client'`). React 19 server actions handle the click → server-side handoff.

- [ ] **Step 4.3: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 4.4: Commit**

```bash
git add apps/web/src/features/auth/sign-out-action.ts apps/web/src/features/auth/sign-out-button.tsx
git commit -m "feat(web): revoke api refresh token on sign-out via server action"
```

---

## Task 5: search query keys + server-only fetcher

**Files:**
- Create: `apps/web/src/features/search/query-keys.ts`
- Create: `apps/web/src/features/search/search-fetchers.ts`

- [ ] **Step 5.1: Create the query-key factory**

```ts
export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, limit: number) => ['search', q, limit] as const,
}
```

- [ ] **Step 5.2: Create the server-only fetcher**

```ts
import 'server-only'

import { SearchResultSchema, type SearchResult } from '@rubik/shared'

import { apiFetch } from '@/lib/api-client'

const DEFAULT_LIMIT = 20

export const getSearchResults = (
  q: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchResult> =>
  apiFetch(
    `/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    SearchResultSchema,
  )
```

- [ ] **Step 5.3: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 5.4: Commit**

```bash
git add apps/web/src/features/search/
git commit -m "feat(web): add search query keys and server-only fetcher"
```

---

## Task 6: client-side search hook

Public endpoint, no auth. Used by both `/search` (after refinement) and the ⌘K palette.

**Files:**
- Create: `apps/web/src/features/search/use-search.ts`

- [ ] **Step 6.1: Write the hook**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { SearchResultSchema, type SearchResult } from '@rubik/shared'

import { publicEnv } from '@/lib/env.client'

import { searchKeys } from './query-keys'

const STALE_TIME_MS = 30_000

const fetchSearch = async (q: string, limit: number): Promise<SearchResult> => {
  const url = `${publicEnv.NEXT_PUBLIC_API_URL}/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`)
  }
  return SearchResultSchema.parse(await res.json())
}

export const useSearch = (q: string, limit = 10) =>
  useQuery({
    queryKey: searchKeys.query(q, limit),
    queryFn: () => fetchSearch(q, limit),
    enabled: q.trim().length > 0,
    staleTime: STALE_TIME_MS,
  })
```

- [ ] **Step 6.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/features/search/use-search.ts
git commit -m "feat(web): add useSearch tanstack query hook"
```

---

## Task 7: SearchInput (URL-pushing client component)

URL is the source of truth. Typing → debounce 300ms → `router.replace('/search?q=…')`. Page re-renders streamingly because `<Suspense key={q}>` re-mounts.

**Files:**
- Create: `apps/web/src/components/search/search-input.tsx`

- [ ] **Step 7.1: Write the component**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 300

export const SearchInput = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = searchParams.get('q') ?? ''
  const [value, setValue] = useState(initial)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (value.trim()) {
        next.set('q', value)
      } else {
        next.delete('q')
      }
      router.replace(`/search?${next.toString()}`)
    }, DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [value, router, searchParams])

  return (
    <input
      type="search"
      placeholder="Search cases by name, set, or notation..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
      autoFocus
    />
  )
}
```

- [ ] **Step 7.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 7.3: Commit**

```bash
git add apps/web/src/components/search/
git commit -m "feat(web): add SearchInput with debounced URL push"
```

---

## Task 8: /search page (RSC + Suspense streaming)

Server component reads `searchParams.q`, fetches results, renders. `<Suspense key={q}>` re-mounts on URL change so the fallback shows during streaming refetch.

**Files:**
- Create: `apps/web/src/app/search/page.tsx`

- [ ] **Step 8.1: Write the page**

```tsx
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { SearchInput } from '@/components/search/search-input'
import { getSearchResults } from '@/features/search/search-fetchers'

export const metadata: Metadata = {
  title: 'Search — rubik-algorithm',
  description: 'Search the algorithm corpus by name, set, or notation.',
}

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

const Results = async ({ q }: { q: string }) => {
  if (!q.trim()) {
    return (
      <p className="mt-8 text-muted-foreground">
        Type a case name, set, or notation.
      </p>
    )
  }
  let result
  try {
    result = await getSearchResults(q, 20)
  } catch {
    return (
      <p className="mt-8 text-muted-foreground">
        Search is briefly unavailable.
      </p>
    )
  }
  if (result.hits.length === 0) {
    return (
      <p className="mt-8 text-muted-foreground">
        No matches. Try fewer characters.
      </p>
    )
  }
  return (
    <ul className="mt-8 space-y-2">
      {result.hits.map((hit) => (
        <li key={hit.caseId}>
          <Link
            href={`/${hit.puzzleSlug}/${hit.methodSlug}/${hit.setSlug}/${hit.caseSlug}` as Route}
            className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
          >
            <div className="text-base font-semibold">{hit.caseName}</div>
            <div className="text-sm text-muted-foreground">
              {hit.puzzleSlug} / {hit.methodSlug} / {hit.setSlug}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Search</h1>
      <SearchInput />
      <Suspense
        key={q}
        fallback={<p className="mt-8 text-muted-foreground">Searching...</p>}
      >
        <Results q={q} />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 8.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/app/search/
git commit -m "feat(web): add /search page (rsc + streaming results)"
```

---

## Task 9: command palette Zustand store

**Files:**
- Create: `apps/web/src/features/command-palette/store.ts`

- [ ] **Step 9.1: Write the store**

```ts
'use client'

import { create } from 'zustand'

interface CommandPaletteState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}))
```

- [ ] **Step 9.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/src/features/command-palette/
git commit -m "feat(web): add command palette zustand store"
```

---

## Task 10: keyboard shortcut hook

Listens for `cmd+k` (mac) / `ctrl+k` (others) globally and invokes a callback. Re-usable for any shortcut later.

**Files:**
- Create: `apps/web/src/components/command-palette/use-keyboard-shortcut.ts`

- [ ] **Step 10.1: Write the hook**

```ts
'use client'

import { useEffect } from 'react'

export const useKeyboardShortcut = (key: string, callback: () => void) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey
      if (isModifier && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        callback()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback])
}
```

- [ ] **Step 10.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 10.3: Commit**

```bash
git add apps/web/src/components/command-palette/
git commit -m "feat(web): add useKeyboardShortcut hook"
```

---

## Task 11: command palette component

Full cmdk dialog: search input, debounced results, four static commands (Browse catalog, My algorithms, Sign in/out, Toggle theme).

**Files:**
- Create: `apps/web/src/components/command-palette/command-palette.tsx`

- [ ] **Step 11.1: Write the component**

```tsx
'use client'

import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useCommandPalette } from '@/features/command-palette/store'
import { useSearch } from '@/features/search/use-search'

import { useKeyboardShortcut } from './use-keyboard-shortcut'

const SEARCH_DEBOUNCE_MS = 200

export const CommandPalette = () => {
  const router = useRouter()
  const { open, setOpen, toggle } = useCommandPalette()
  const { data: session } = useSession()
  const { setTheme, theme } = useTheme()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useKeyboardShortcut('k', toggle)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const { data: results } = useSearch(debounced, 10)

  const navigate = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href as Route)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type to search or run a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {results && results.hits.length > 0 ? (
          <>
            <CommandGroup heading="Cases">
              {results.hits.map((h) => (
                <CommandItem
                  key={h.caseId}
                  value={`case-${h.caseId}`}
                  onSelect={() =>
                    navigate(
                      `/${h.puzzleSlug}/${h.methodSlug}/${h.setSlug}/${h.caseSlug}`,
                    )
                  }
                >
                  <span className="font-medium">{h.caseName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {h.methodSlug} / {h.setSlug}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        <CommandGroup heading="Navigation">
          <CommandItem value="nav-catalog" onSelect={() => navigate('/3x3')}>
            Browse catalog
          </CommandItem>
          {session ? (
            <CommandItem
              value="nav-my-algorithms"
              onSelect={() => navigate('/me/algorithms')}
            >
              My algorithms
            </CommandItem>
          ) : null}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            value="action-toggle-theme"
            onSelect={() => {
              setOpen(false)
              setTheme(theme === 'dark' ? 'light' : 'dark')
            }}
          >
            Toggle theme
          </CommandItem>
          {session ? (
            <CommandItem
              value="action-sign-out"
              onSelect={() => navigate('/api/auth/signout')}
            >
              Sign out
            </CommandItem>
          ) : (
            <CommandItem value="action-sign-in" onSelect={() => navigate('/login')}>
              Sign in
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

Note: the palette's "Sign out" navigates to Auth.js's built-in `/api/auth/signout` confirmation page instead of replicating the server-action revoke flow. The dedicated `<SignOutButton />` (Task 4) handles full revoke for the header. This is the documented Auth.js v5 fallback path.

- [ ] **Step 11.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green. The `as Route` cast on `router.push` matches the 7b precedent for dynamic href strings (see 7b's MethodCard).

- [ ] **Step 11.3: Commit**

```bash
git add apps/web/src/components/command-palette/command-palette.tsx
git commit -m "feat(web): add command palette with search + static commands"
```

---

## Task 12: mount palette + ⌘K trigger in header

The palette only works when mounted globally. Add it to `app/layout.tsx`. Add a small `<kbd>⌘K</kbd>` button to `<SiteHeader />` that calls `useCommandPalette().setOpen(true)`.

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/layout/site-header.tsx`
- Create: `apps/web/src/components/layout/command-palette-trigger.tsx`

- [ ] **Step 12.1: Add trigger client component**

```tsx
'use client'

import { useCommandPalette } from '@/features/command-palette/store'

export const CommandPaletteTrigger = () => {
  const setOpen = useCommandPalette((s) => s.setOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="hidden items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-accent sm:flex"
      aria-label="Open command palette"
    >
      Search
      <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  )
}
```

- [ ] **Step 12.2: Mount the palette + trigger**

In `apps/web/src/app/layout.tsx`, replace the import block and the body's body of `<RootProviders>`:

Replace this block (lines 4-7):

```ts
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

import { SiteHeader } from '@/components/layout/site-header'
import { RootProviders } from '@/providers/root-providers'
```

with:

```ts
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

import { CommandPalette } from '@/components/command-palette/command-palette'
import { SiteHeader } from '@/components/layout/site-header'
import { RootProviders } from '@/providers/root-providers'
```

Replace the `<RootProviders>` body (around lines 22-26):

```tsx
        <RootProviders>
          <SiteHeader />
          {children}
          <Toaster richColors position="top-right" />
        </RootProviders>
```

with:

```tsx
        <RootProviders>
          <SiteHeader />
          {children}
          <CommandPalette />
          <Toaster richColors position="top-right" />
        </RootProviders>
```

- [ ] **Step 12.3: Add the trigger to SiteHeader**

In `apps/web/src/components/layout/site-header.tsx`, replace the existing `<nav>` block (around lines 16-20):

```tsx
        <nav className="flex items-center gap-6">
          <Link href="/3x3" className="text-sm font-medium hover:underline">
            Catalog
          </Link>
        </nav>
```

with:

```tsx
        <nav className="flex items-center gap-6">
          <Link href="/3x3" className="text-sm font-medium hover:underline">
            Catalog
          </Link>
          <CommandPaletteTrigger />
        </nav>
```

And add this import beside the existing imports:

```ts
import { CommandPaletteTrigger } from './command-palette-trigger'
```

- [ ] **Step 12.4: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 12.5: Verify QueryProvider scope**

The palette uses TanStack Query (`useSearch`); confirm the existing `<RootProviders>` (which mounts `<QueryProvider>` outside `<ThemeProvider>` per 7a) wraps the palette. Check `apps/web/src/providers/root-providers.tsx`. If the palette is not a descendant of `QueryClientProvider`, mounting will throw at runtime.

```bash
grep -A5 "RootProviders" apps/web/src/providers/root-providers.tsx
```

Expected output shows `QueryProvider` wrapping `{children}` — the palette is a child of `<RootProviders>`, so it gets the client.

- [ ] **Step 12.6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/components/layout/
git commit -m "feat(web): mount command palette and add ⌘K trigger to header"
```

---

## Task 13: /me query keys + server-only fetchers

**Files:**
- Create: `apps/web/src/features/me/query-keys.ts`
- Create: `apps/web/src/features/me/me-fetchers.ts`

- [ ] **Step 13.1: Create query-keys**

```ts
export const meKeys = {
  all: ['me'] as const,
  algorithms: ['me', 'algorithms'] as const,
}
```

- [ ] **Step 13.2: Create server fetcher**

```ts
import 'server-only'

import { UserAlgorithmSchema, type UserAlgorithm } from '@rubik/shared'
import { z } from 'zod'

import { apiFetch } from '@/lib/api-client'

const UserAlgorithmsSchema = z.array(UserAlgorithmSchema)

export const getMyAlgorithms = (accessToken: string): Promise<UserAlgorithm[]> =>
  apiFetch('/v1/me/algorithms', UserAlgorithmsSchema, { accessToken })
```

- [ ] **Step 13.3: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 13.4: Commit**

```bash
git add apps/web/src/features/me/query-keys.ts apps/web/src/features/me/me-fetchers.ts
git commit -m "feat(web): add /me query keys and server-only fetcher"
```

---

## Task 14: /me client hooks (read + mutate)

Three TanStack Query hooks: list (with hydration), update, delete. Mutations are optimistic.

**Files:**
- Create: `apps/web/src/features/me/use-my-algorithms.ts`
- Create: `apps/web/src/features/me/use-update-algorithm.ts`
- Create: `apps/web/src/features/me/use-delete-algorithm.ts`

- [ ] **Step 14.1: Read hook**

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { UserAlgorithmSchema, type UserAlgorithm } from '@rubik/shared'
import { useSession } from 'next-auth/react'
import { z } from 'zod'

import { publicEnv } from '@/lib/env.client'

import { meKeys } from './query-keys'

const STALE_TIME_MS = 5_000
const UserAlgorithmsSchema = z.array(UserAlgorithmSchema)

export const useMyAlgorithms = () => {
  const { data: session } = useSession()
  const token = session?.apiAccessToken
  return useQuery({
    queryKey: meKeys.algorithms,
    queryFn: async (): Promise<UserAlgorithm[]> => {
      if (!token) throw new Error('not authed')
      const res = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_URL}/v1/me/algorithms`,
        {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      )
      if (!res.ok) throw new Error(`/me/algorithms ${res.status}`)
      return UserAlgorithmsSchema.parse(await res.json())
    },
    enabled: !!token,
    staleTime: STALE_TIME_MS,
  })
}
```

- [ ] **Step 14.2: Update hook**

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserAlgorithmSchema,
  type LearningStatus,
  type UserAlgorithm,
} from '@rubik/shared'
import { useSession } from 'next-auth/react'

import { publicEnv } from '@/lib/env.client'

import { meKeys } from './query-keys'

interface UpdateInput {
  caseId: string
  caseSlug: string
  status: LearningStatus
}

interface OptimisticContext {
  prev: UserAlgorithm[] | undefined
}

export const useUpdateAlgorithm = () => {
  const { data: session } = useSession()
  const token = session?.apiAccessToken
  const qc = useQueryClient()

  return useMutation<UserAlgorithm, Error, UpdateInput, OptimisticContext>({
    mutationFn: async (input) => {
      if (!token) throw new Error('not authed')
      const res = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_URL}/v1/me/algorithms/${input.caseSlug}`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ status: input.status }),
          cache: 'no-store',
        },
      )
      if (!res.ok) throw new Error(`PUT /me/algorithms ${res.status}`)
      return UserAlgorithmSchema.parse(await res.json())
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: meKeys.algorithms })
      const prev = qc.getQueryData<UserAlgorithm[]>(meKeys.algorithms)
      qc.setQueryData<UserAlgorithm[]>(meKeys.algorithms, (old = []) => {
        const idx = old.findIndex((u) => u.caseId === input.caseId)
        const now = new Date().toISOString()
        if (idx >= 0) {
          const next = old.slice()
          next[idx] = { ...old[idx]!, status: input.status, updatedAt: now }
          return next
        }
        return [
          ...old,
          {
            caseId: input.caseId,
            chosenVariantId: null,
            status: input.status,
            personalNotesMd: null,
            updatedAt: now,
          },
        ]
      })
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(meKeys.algorithms, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: meKeys.algorithms })
    },
  })
}
```

- [ ] **Step 14.3: Delete hook**

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type UserAlgorithm } from '@rubik/shared'
import { useSession } from 'next-auth/react'

import { publicEnv } from '@/lib/env.client'

import { meKeys } from './query-keys'

interface DeleteInput {
  caseId: string
  caseSlug: string
}

interface OptimisticContext {
  prev: UserAlgorithm[] | undefined
}

export const useDeleteAlgorithm = () => {
  const { data: session } = useSession()
  const token = session?.apiAccessToken
  const qc = useQueryClient()

  return useMutation<void, Error, DeleteInput, OptimisticContext>({
    mutationFn: async (input) => {
      if (!token) throw new Error('not authed')
      const res = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_URL}/v1/me/algorithms/${input.caseSlug}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      )
      if (!res.ok && res.status !== 204) {
        throw new Error(`DELETE /me/algorithms ${res.status}`)
      }
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: meKeys.algorithms })
      const prev = qc.getQueryData<UserAlgorithm[]>(meKeys.algorithms)
      qc.setQueryData<UserAlgorithm[]>(meKeys.algorithms, (old = []) =>
        old.filter((u) => u.caseId !== input.caseId),
      )
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(meKeys.algorithms, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: meKeys.algorithms })
    },
  })
}
```

- [ ] **Step 14.4: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 14.5: Commit**

```bash
git add apps/web/src/features/me/use-my-algorithms.ts apps/web/src/features/me/use-update-algorithm.ts apps/web/src/features/me/use-delete-algorithm.ts
git commit -m "feat(web): add /me read + mutate hooks with optimistic updates"
```

---

## Task 15: extend catalog-fetchers with getAllCases

`/me/algorithms` rows carry `caseId` (cuid) but render needs `displayName`, `slug`, and the breadcrumb. Walk the catalog tree once at RSC time and build a `Record<caseId, …>`.

**Files:**
- Modify: `apps/web/src/features/catalog/catalog-fetchers.ts`

- [ ] **Step 15.1: Append getAllCases to the fetcher module**

Open `apps/web/src/features/catalog/catalog-fetchers.ts` and append:

```ts
export interface CaseLocation {
  case: AlgorithmCase
  setSlug: string
  methodSlug: string
  puzzleSlug: string
}

export const getAllCases = async (): Promise<CaseLocation[]> => {
  const puzzles = await getPuzzles()
  const perPuzzle = await Promise.all(
    puzzles.map(async (p) => {
      const methods = await getMethods(p.slug)
      const perMethod = await Promise.all(
        methods.map(async (m) => {
          const sets = await getSets(p.slug, m.slug)
          const perSet = await Promise.all(
            sets.map(async (s) => {
              const setData = await getSetWithCases(s.slug)
              return setData.cases.map(
                (c): CaseLocation => ({
                  case: c,
                  setSlug: s.slug,
                  methodSlug: m.slug,
                  puzzleSlug: p.slug,
                }),
              )
            }),
          )
          return perSet.flat()
        }),
      )
      return perMethod.flat()
    }),
  )
  return perPuzzle.flat()
}
```

Add `AlgorithmCase` to the existing import block:

```ts
import {
  AlgorithmCaseWithVariantsSchema,
  AlgorithmSetSchema,
  AlgorithmSetWithCasesSchema,
  MethodSchema,
  PuzzleSchema,
  type AlgorithmCase,
  type AlgorithmCaseWithVariants,
  type AlgorithmSet,
  type AlgorithmSetWithCases,
  type Method,
  type Puzzle,
} from '@rubik/shared'
```

- [ ] **Step 15.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 15.3: Commit**

```bash
git add apps/web/src/features/catalog/catalog-fetchers.ts
git commit -m "feat(web): add getAllCases fetcher for cross-tree case lookup"
```

---

## Task 16: /me layout (auth gate)

The layout runs `auth()` on every `/me/*` request. If no session, redirect to `/login?next=…`. Children render only when authed.

**Files:**
- Create: `apps/web/src/app/me/layout.tsx`

- [ ] **Step 16.1: Write the layout**

```tsx
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { auth } from '@/lib/auth/auth.config'

export default async function MeLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.apiAccessToken) {
    redirect('/login?next=/me/algorithms')
  }
  return <>{children}</>
}
```

- [ ] **Step 16.2: Verify typecheck**

```bash
pnpm --filter @rubik/web typecheck
```

Expected: green.

- [ ] **Step 16.3: Commit**

```bash
git add apps/web/src/app/me/layout.tsx
git commit -m "feat(web): add /me layout with auth gate"
```

---

## Task 17: /me presentation components (empty state + table)

**Files:**
- Create: `apps/web/src/components/me/empty-state.tsx`
- Create: `apps/web/src/components/me/algorithms-table.tsx`

- [ ] **Step 17.1: Empty state**

```tsx
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const EmptyState = () => (
  <div className="rounded-lg border border-border bg-card p-12 text-center">
    <h2 className="mb-2 text-xl font-semibold">No algorithms tracked yet</h2>
    <p className="mb-6 text-muted-foreground">
      Visit a case page and pick a status to start tracking it here.
    </p>
    <Button asChild>
      <Link href="/3x3">Browse the catalog</Link>
    </Button>
  </div>
)
```

- [ ] **Step 17.2: Algorithms table**

```tsx
'use client'

import { LEARNING_STATUSES, type LearningStatus } from '@rubik/shared'
import { Trash2 } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CaseLocation } from '@/features/catalog/catalog-fetchers'
import { useDeleteAlgorithm } from '@/features/me/use-delete-algorithm'
import { useMyAlgorithms } from '@/features/me/use-my-algorithms'
import { useUpdateAlgorithm } from '@/features/me/use-update-algorithm'

import { EmptyState } from './empty-state'

interface Props {
  casesById: Record<string, CaseLocation>
}

const MIN_DIFF_MS = 60_000
const HOUR_MS = 60 * MIN_DIFF_MS
const DAY_MS = 24 * HOUR_MS

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < MIN_DIFF_MS) return 'just now'
  if (diff < HOUR_MS) return `${Math.round(diff / MIN_DIFF_MS)}m ago`
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h ago`
  return `${Math.round(diff / DAY_MS)}d ago`
}

export const AlgorithmsTable = ({ casesById }: Props) => {
  const { data, isLoading, error } = useMyAlgorithms()
  const update = useUpdateAlgorithm()
  const del = useDeleteAlgorithm()

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>
  if (error) {
    return (
      <p className="text-destructive">
        Failed to load. Try signing in again.
      </p>
    )
  }
  if (!data || data.length === 0) return <EmptyState />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const loc = casesById[row.caseId]
          if (!loc) return null
          const href =
            `/${loc.puzzleSlug}/${loc.methodSlug}/${loc.setSlug}/${loc.case.slug}` as Route
          return (
            <TableRow key={row.caseId}>
              <TableCell>
                <Link href={href} className="font-medium hover:underline">
                  {loc.case.displayName}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {loc.methodSlug} / {loc.setSlug}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={row.status}
                  disabled={update.isPending}
                  onValueChange={(v) =>
                    update.mutate(
                      {
                        caseId: row.caseId,
                        caseSlug: loc.case.slug,
                        status: v as LearningStatus,
                      },
                      { onError: () => toast.error('Update failed') },
                    )
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEARNING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelative(row.updatedAt)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={del.isPending}
                  onClick={() =>
                    del.mutate(
                      { caseId: row.caseId, caseSlug: loc.case.slug },
                      { onError: () => toast.error('Delete failed') },
                    )
                  }
                  aria-label={`Untrack ${loc.case.displayName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 17.3: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 17.4: Commit**

```bash
git add apps/web/src/components/me/
git commit -m "feat(web): add /me empty state and algorithms table"
```

---

## Task 18: /me/algorithms page (RSC + HydrationBoundary)

Server prefetches `/v1/me/algorithms` into a `QueryClient`, walks the catalog tree once for `casesById`, hands both to the client `<AlgorithmsTable />`.

**Files:**
- Create: `apps/web/src/app/me/algorithms/page.tsx`

- [ ] **Step 18.1: Write the page**

```tsx
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import type { Metadata } from 'next'

import { AlgorithmsTable } from '@/components/me/algorithms-table'
import { getAllCases } from '@/features/catalog/catalog-fetchers'
import { getMyAlgorithms } from '@/features/me/me-fetchers'
import { meKeys } from '@/features/me/query-keys'
import { auth } from '@/lib/auth/auth.config'

export const metadata: Metadata = {
  title: 'My algorithms — rubik-algorithm',
  description: 'Track which algorithms you are learning, learned, and mastered.',
}

export default async function MyAlgorithmsPage() {
  const session = await auth()
  const token = session!.apiAccessToken!

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: meKeys.algorithms,
    queryFn: () => getMyAlgorithms(token),
  })

  const allCases = await getAllCases()
  const casesById = Object.fromEntries(allCases.map((c) => [c.case.id, c]))

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">My algorithms</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AlgorithmsTable casesById={casesById} />
      </HydrationBoundary>
    </main>
  )
}
```

The non-null assertions on `session!.apiAccessToken!` are safe — `/me/layout.tsx` redirects when null, so this code only runs when authed.

- [ ] **Step 18.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 18.3: Commit**

```bash
git add apps/web/src/app/me/algorithms/
git commit -m "feat(web): add /me/algorithms page with rsc prefetch + hydrate"
```

---

## Task 19: TrackCaseButton (case-page CTA)

Reusable client component on the case page. Reads initial status from a server-rendered prop, drives PUT/DELETE through the same hooks as the table.

**Files:**
- Create: `apps/web/src/components/track-case/track-case-button.tsx`

- [ ] **Step 19.1: Write the component**

```tsx
'use client'

import { LEARNING_STATUSES, type LearningStatus, type UserAlgorithm } from '@rubik/shared'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeleteAlgorithm } from '@/features/me/use-delete-algorithm'
import { useUpdateAlgorithm } from '@/features/me/use-update-algorithm'

interface Props {
  caseId: string
  caseSlug: string
  initialAlgorithm: UserAlgorithm | null
}

const NOT_TRACKED = 'not-tracked' as const
type Choice = LearningStatus | typeof NOT_TRACKED

export const TrackCaseButton = ({ caseId, caseSlug, initialAlgorithm }: Props) => {
  const [current, setCurrent] = useState<Choice>(
    initialAlgorithm?.status ?? NOT_TRACKED,
  )
  const update = useUpdateAlgorithm()
  const del = useDeleteAlgorithm()

  const onChange = (next: Choice) => {
    const previous = current
    setCurrent(next)
    if (next === NOT_TRACKED) {
      del.mutate(
        { caseId, caseSlug },
        {
          onSuccess: () => toast.success('Removed from tracking'),
          onError: () => {
            setCurrent(previous)
            toast.error('Failed to remove')
          },
        },
      )
    } else {
      update.mutate(
        { caseId, caseSlug, status: next },
        {
          onSuccess: () => toast.success(`Marked as ${next}`),
          onError: () => {
            setCurrent(previous)
            toast.error('Failed to update')
          },
        },
      )
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Track:</span>
      <Select
        value={current}
        onValueChange={(v) => onChange(v as Choice)}
        disabled={update.isPending || del.isPending}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_TRACKED}>Not tracked</SelectItem>
          {LEARNING_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 19.2: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 19.3: Commit**

```bash
git add apps/web/src/components/track-case/
git commit -m "feat(web): add TrackCaseButton for case-page CTA"
```

---

## Task 20: case page wiring

Modify the existing case page to render `<TrackCaseButton />` when the user is authed; otherwise show a sign-in prompt.

**Files:**
- Modify: `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`

- [ ] **Step 20.1: Add new imports**

Open `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`. After the existing imports block (top of file), add:

```ts
import Link from 'next/link'
import type { UserAlgorithm } from '@rubik/shared'

import { TrackCaseButton } from '@/components/track-case/track-case-button'
import { getMyAlgorithms } from '@/features/me/me-fetchers'
import { auth } from '@/lib/auth/auth.config'
```

(Note: `Link` may already be imported from the 7b-fix commit. Check before adding to avoid duplicates.)

- [ ] **Step 20.2: Fetch tracking state in parallel with case data**

Replace the existing parallel fetch block (around line 59):

```tsx
  let caseData
  let setData
  try {
    ;[caseData, setData] = await Promise.all([
      getCaseWithVariants(caseSlug),
      getSetWithCases(set),
    ])
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }
```

with:

```tsx
  const session = await auth()
  let caseData
  let setData
  let myAlgorithm: UserAlgorithm | null = null
  try {
    ;[caseData, setData] = await Promise.all([
      getCaseWithVariants(caseSlug),
      getSetWithCases(set),
    ])
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }
  if (session?.apiAccessToken) {
    try {
      const list = await getMyAlgorithms(session.apiAccessToken)
      myAlgorithm = list.find((u) => u.caseId === caseData.id) ?? null
    } catch {
      myAlgorithm = null
    }
  }
```

- [ ] **Step 20.3: Render the CTA below the heading**

Find the existing `<h1>` block (around line 86):

```tsx
      <h1 className="mb-8 text-4xl font-bold">{caseData.displayName}</h1>
```

Insert immediately after:

```tsx
      <div className="mb-8">
        {session?.apiAccessToken ? (
          <TrackCaseButton
            caseId={caseData.id}
            caseSlug={caseData.slug}
            initialAlgorithm={myAlgorithm}
          />
        ) : (
          <Link
            href="/login?next=/3x3/cfop/pll/t-perm"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Sign in to track this case
          </Link>
        )}
      </div>
```

(The hard-coded `next=` is intentional — for v1, the back-redirect is best-effort. A correct dynamic `next` requires reading the current pathname, which we'd need a client component for. Acceptable simplification.)

- [ ] **Step 20.4: Verify typecheck + lint**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: green.

- [ ] **Step 20.5: Commit**

```bash
git add apps/web/src/app/3x3/\[method\]/\[set\]/\[case\]/page.tsx
git commit -m "feat(web): wire TrackCaseButton into case page"
```

---

## Task 21: build smoke (no commit)

The build is the most thorough gate. It runs `generateStaticParams` against the live api at build time, so the api MUST be running.

- [ ] **Step 21.1: Confirm api is up**

```bash
curl -s http://localhost:3001/v1/puzzles | jq -c '.[] | {slug}'
```

Expected: `{"slug":"3x3"}`. If empty/error, start the api: `pnpm --filter @rubik/api dev`.

- [ ] **Step 21.2: Run typecheck + lint + build**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
pnpm --filter @rubik/web build
```

Expected:
- typecheck and lint: green.
- build: 19+ static pages (catalog routes — adding `/search` and `/me/algorithms` keeps the SSG count at 14 catalog pages because the new ones are dynamic). Output should list `/search` and `/me/algorithms` as `ƒ (Dynamic)` since they read auth + params.

- [ ] **Step 21.3: Confirm bundle stays under budget**

In the build output, look at "First Load JS shared by all" and the per-route sizes. Target: `<200 kB` for any route's First Load JS (per `070-testing-rule.md` §19.9 budget). cmdk + dialog primitives can push this up; if the search page or `/me/algorithms` exceeds 200 kB, flag it as a follow-up but do not block.

- [ ] **Step 21.4: No commit for this task** — verification only.

---

## Task 22: manual smoke verification (no commit)

Validates all four features against real seeded data + a real Google sign-in.

- [ ] **Step 22.1: Boot web dev**

```bash
pnpm --filter @rubik/web dev
```

Wait for "Ready in N ms" on `http://localhost:3000`.

- [ ] **Step 22.2: Visit `/search`**

Browser: `http://localhost:3000/search`. Expected: header, "Search" h1, focused search input, "Type a case name, set, or notation." placeholder. Type `t-perm`. Expected: after 300ms the URL becomes `/search?q=t-perm`, the page streams in 1 result linking to `/3x3/cfop/pll/t-perm`.

- [ ] **Step 22.3: Test ⌘K palette**

Anywhere on the site, press `⌘K` (mac) or `ctrl+K` (linux/win). Expected: Dialog opens, focus in the input. Type `aa-perm`. Expected: a "Cases" group with 1 hit. Press ↓ to highlight, Enter — palette closes, browser navigates to `/3x3/cfop/pll/aa-perm`. Re-open palette, clear input. Expected: only "Navigation" + "Actions" groups visible. Click "Toggle theme". Expected: page re-renders in the opposite mode.

- [ ] **Step 22.4: Sign in**

Click "Sign in with Google" in the header. Complete Google OAuth flow. Expected: header now shows your email + a Sign out button.

- [ ] **Step 22.5: Visit `/me/algorithms` while empty**

Browser: `http://localhost:3000/me/algorithms`. Expected: "My algorithms" h1, EmptyState card with "No algorithms tracked yet" + Browse the catalog button.

- [ ] **Step 22.6: Track a case from the case page**

Browser: `http://localhost:3000/3x3/cfop/pll/t-perm`. Expected: below the H1, a "Track:" select with "Not tracked". Click → choose "learning". Expected: sonner toast "Marked as learning"; select shows "learning".

- [ ] **Step 22.7: Confirm /me/algorithms reflects the change**

Browser: `http://localhost:3000/me/algorithms`. Expected: a single row for T-Perm, status "learning", updated "just now", and a trash icon. Open the row's status select, change to "learned". Expected: row updates instantly (optimistic), no flicker. Click trash. Expected: row disappears instantly. Refresh. Expected: empty state again.

- [ ] **Step 22.8: Test sign-out revoke**

In the header, click "Sign out". Expected: brief navigation, returns to `/`. Manually verify the api revoked the refresh token by inspecting `apps/api` logs for a `POST /v1/auth/logout 204` line.

- [ ] **Step 22.9: Test redirect from /me when signed out**

Visit `http://localhost:3000/me/algorithms` while signed out. Expected: redirect to `/login?next=/me/algorithms`.

- [ ] **Step 22.10: Stop dev**

Ctrl-C the `pnpm --filter @rubik/web dev` process.

If any step fails, do not close the sub-phase — fix and re-test.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

```bash
git log --oneline 4e2d32f..HEAD
```

Expected (newest first):

```
<hash> feat(web): wire TrackCaseButton into case page
<hash> feat(web): add TrackCaseButton for case-page CTA
<hash> feat(web): add /me/algorithms page with rsc prefetch + hydrate
<hash> feat(web): add /me empty state and algorithms table
<hash> feat(web): add /me layout with auth gate
<hash> feat(web): add getAllCases fetcher for cross-tree case lookup
<hash> feat(web): add /me read + mutate hooks with optimistic updates
<hash> feat(web): add /me query keys and server-only fetcher
<hash> feat(web): mount command palette and add ⌘K trigger to header
<hash> feat(web): add command palette with search + static commands
<hash> feat(web): add useKeyboardShortcut hook
<hash> feat(web): add command palette zustand store
<hash> feat(web): add /search page (rsc + streaming results)
<hash> feat(web): add SearchInput with debounced URL push
<hash> feat(web): add useSearch tanstack query hook
<hash> feat(web): add search query keys and server-only fetcher
<hash> feat(web): revoke api refresh token on sign-out via server action
<hash> feat(web): proactively rotate api tokens in auth.js jwt callback
<hash> feat(web): add server-only refreshApiTokens helper
<hash> chore(web): vendor shadcn dialog, command, select, table primitives
```

- [ ] **Step F.2: Confirm full quality gates**

```bash
pnpm --filter @rubik/web typecheck && \
  pnpm --filter @rubik/web lint && \
  pnpm --filter @rubik/web build
```

(api must still be running for SSG.) Expected: all green.

- [ ] **Step F.3: Done-when checklist**

```
- [x] Token rotation lives in Auth.js jwt callback; sign-out POSTs /v1/auth/logout
- [x] /search?q= ships RSC + client SearchInput with debounced URL push
- [x] ⌘K command palette mounted globally; cmd/ctrl+K toggles it
- [x] Palette has search results + Browse catalog + My algorithms (when authed) + Toggle theme + Sign in/out
- [x] /me/algorithms is auth-gated by /me/layout.tsx
- [x] /me/algorithms RSC prefetches + hydrates; client AlgorithmsTable renders
- [x] Status select PUTs and table updates optimistically; rollback on error
- [x] Trash button DELETEs and row disappears optimistically; rollback on error
- [x] Case page renders <TrackCaseButton /> when authed, sign-in link otherwise
- [x] Case page CTA round-trips PUT/DELETE with sonner feedback
- [x] pnpm --filter @rubik/web typecheck && lint && build clean
- [x] Smoke 22.2-22.9 verified locally with the running api
- [x] Commits follow lowercase Conventional Commits with scope `web`
```

---

## Out of scope (do not implement)

- Virtualized rows on `/me/algorithms` — defer until corpus crosses ~50 cases (YAGNI).
- `chosenVariantId` picker on case page or `/me/algorithms` — defer to next sub-phase.
- `personalNotesMd` rich editor — defer.
- Search-result highlighting (api returns `matchHighlight: null` today; needs api work).
- Search SEO (results pages aren't indexed).
- Sentry / Storybook / Playwright e2e — all 7d.
- Mobile-optimized palette (touch-first nav) — 7d.
- Sitemap, robots, JSON-LD, OG image — 7d.
- /timer, /embed/visualizer — 7d.
- `(app)`, `(marketing)`, `(auth)` route groups — 7d.

---

## Risk register (summary — see design doc for full notes)

| Risk | Mitigation |
|---|---|
| Auth.js `jwt` callback rotation may not fire on every read | Test in Task 22.8 with a long idle. Fall back to retry-on-401 if proactive rotation is silently broken. |
| Optimistic update + 401 race ghost row | Mutation reads `session.apiAccessToken` inside `mutationFn`; on 401, surface error and rely on user to re-auth. |
| `cmdk` Dialog SSR/CSR mismatch on static commands | Static-command visibility computed client-side via `useSession()` — no SSR mismatch. |
| `getAllCases` is a tree walk; expensive at full corpus | `staleTime: Infinity` + RSC handoff means once-per-page cost; revisit when corpus grows. |
| Status dropdown mid-edit while api response in-flight | Disable Select while `update.isPending`. |
| Server-action sign-out path doesn't catch palette's "Sign out" | Palette uses Auth.js's own `/api/auth/signout` page as a fallback (no api revoke). The dedicated `<SignOutButton />` handles full revoke. |
