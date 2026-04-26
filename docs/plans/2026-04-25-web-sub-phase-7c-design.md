# Web sub-phase 7c — Search, Command Palette, /me/algorithms, Token Refresh

> Plan 07 sub-phase 7c. Catalog browsing (7b) shipped to `main`; the api exposes search + me + auth/refresh and the JWT/cookie scaffolding from 7a is live. This sub-phase adds the discovery layer (search + ⌘K) and the auth-gated tracking surface (/me/algorithms + case-page "Track this case"), plus token rotation in the Auth.js `jwt` callback.

## 1. Goal

Ship the discovery + tracking surface so a signed-in user can:

- Find any case by name, slug, set, or method via `/search?q=...` or ⌘K command palette.
- Mark a case as `learning`, `learned`, or `mastered` from the case page.
- See, edit, and delete their tracked algorithms at `/me/algorithms`.

And ship the supporting plumbing:

- Auth.js v5 `jwt` callback rotates the api access token before it expires (proactive refresh).
- `/v1/auth/logout` is invoked on sign-out so the api revokes the refresh token.

## 2. Out of scope

| Item | Why deferred |
|---|---|
| Virtualized rows on /me/algorithms | 9 seeded cases; revisit when corpus crosses ~50 (YAGNI). |
| `chosenVariantId` picker | Most users keep the primary; UI complexity not yet justified. |
| `personalNotesMd` rich editor | A plain `<textarea>` is fine for v1; rich markdown editor is 7d+. |
| Search-result highlighting | api returns `matchHighlight: null` today; needs api work first. |
| Search SEO (indexable results pages) | Results are inherently dynamic; no canonical version to index. |
| `/timer`, `/embed/visualizer`, sitemap, JSON-LD, OG image | All 7d. |
| Mobile-optimized palette | Cmd-K is keyboard-first; touch UX bundled with 7d nav work. |
| Sentry, Storybook, Playwright e2e | All 7d. |

## 3. User-visible surfaces

### 3.1 `/search?q=…`

Server component. Reads `searchParams.q` (Next 15 Promise pattern). When `q` is empty: shows a placeholder ("Type a case name, set, or notation"). When non-empty: server-fetches `/v1/search?q=…&limit=20`, renders a result list. Each hit links to `/3x3/{methodSlug}/{setSlug}/{caseSlug}` and shows breadcrumb + name + rank-sorted.

A client `<SearchInput>` sits at the top, debounced 300ms. On change it pushes the URL via `router.replace('/search?q=…')`. The URL is the source of truth — bookmarkable, shareable, back-button-friendly.

**Edge cases:**
- Empty query → don't fire api call. Show placeholder.
- Zero hits → empty state with "Try fewer characters" tip.
- Api 5xx → swallow + show "Search is briefly unavailable" (don't `throw notFound()`; results page should fail gracefully).

### 3.2 ⌘K command palette

Mounted globally in the root layout (after `<SiteHeader />`). Toggled via:

- `cmd+K` on macOS, `ctrl+K` elsewhere
- Header keyboard-shortcut hint button (`<kbd>⌘K</kbd>`)
- Programmatic: `useCommandPalette().open()`

Built on `cmdk` (already installed). Inside the dialog:

1. **Search results** (live, debounced 200ms): `/v1/search?q=…&limit=10`. Each row → navigate to case page. Renders only when `q.length > 0`.
2. **Static commands** (always visible when `q` is empty):
   - "Browse catalog" → `/3x3`
   - "My algorithms" → `/me/algorithms` (only when authed)
   - "Sign in" / "Sign out" (mutually exclusive based on session)
   - "Toggle theme" (light/dark) — wires `next-themes` already installed in 7a

Enter navigates; Escape closes; arrow keys move selection. State via Zustand (`useCommandPalette` — single boolean + open/close/toggle actions). Authed-state read from a server-rendered prop or `useSession()` (client).

### 3.3 `/me/algorithms`

Auth-gated by `/me/layout.tsx`:

```ts
export default async function MeLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/me/algorithms')
  return <>{children}</>
}
```

Page is a client component (`'use client'`) hydrated by RSC. Server fetches `/v1/me/algorithms` and `dehydrate(queryClient)`s it; client mounts with the data already in the cache.

Renders shadcn `<Table>`:

| Column | Source | Render |
|---|---|---|
| Case | `caseId` → fetched once, joined client-side | `<Link>` to case page with displayName + set/method breadcrumb |
| Status | `userAlgorithm.status` | `<Select>` (learning/learned/mastered) → triggers PUT |
| Updated | `updatedAt` | Relative time ("3 days ago") via `Intl.RelativeTimeFormat` |
| Actions | — | Trash icon button → DELETE |

Mutations:

- **PUT** `/v1/me/algorithms/:caseSlug` with `{ status }`. Optimistic: update cache row immediately, rollback on error.
- **DELETE** `/v1/me/algorithms/:caseSlug`. Optimistic: remove row, rollback on error.

Empty state ("You haven't tracked any cases yet — visit a [case page]") with a `<Link>` to `/3x3`.

**The `caseId → case` join** is the awkward part. The `/v1/me/algorithms` payload only carries `caseId`, not the slug or display name. Two paths:

- **A. Fetch all cases once** (one extra api call, ~21 PLLs + 41 F2L + 57 OLL = 119 cases when fully seeded; today 9). Build a `Map<caseId, AlgorithmCase>` and join client-side.
- **B. Extend the api** to return joined `{ caseSlug, caseName, setSlug, methodSlug, ...}` from `/v1/me/algorithms`.

**Decision: A** — the api change is a 7d concern (or its own sub-phase), and even at full corpus a single `/v1/cases` cache-hit is cheap. Add `getAllCases` to the catalog fetcher set; cache `staleTime: Infinity` since case identity doesn't change.

### 3.4 Case-page "Track this case" CTA

Modify `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`:

- Server fetches `getCurrentUser()` in parallel with the existing case fetch.
- If `user` is null: render a small "Sign in to track" link (no widget).
- If authed: render `<TrackCaseButton caseSlug={...} initialStatus={...} />` (client). Initial status fetched server-side too, via a new `getMyAlgorithm(caseSlug)` fetcher that calls `/v1/me/algorithms` and finds the row (or returns `null`).

`<TrackCaseButton />` is a client component:

- Status dropdown (`<Select>`): "Not tracked / Learning / Learned / Mastered".
- "Not tracked" + change → PUT with `{ status: 'learning' }`.
- Already tracked + change → PUT.
- Already tracked + select "Not tracked" → DELETE.
- `sonner` toast on success ("Marked as Learning") and failure.

## 4. Auth + token refresh

### 4.1 Proactive refresh in the Auth.js `jwt` callback

Today the `jwt` callback only handles initial sign-in. Extend it:

```ts
jwt: async ({ token, account }) => {
  // Initial sign-in
  if (account?.provider === 'google' && account.id_token) {
    const pair = await googleHandshake(account.id_token)
    return {
      ...token,
      apiAccessToken: pair.accessToken,
      apiRefreshToken: pair.refreshToken,
      apiExpiresAt: Date.now() + pair.expiresIn * 1000,
    }
  }
  // Subsequent reads — rotate if near expiry
  if (token.apiAccessToken && token.apiExpiresAt) {
    const skew = 60_000
    if (token.apiExpiresAt - Date.now() < skew) {
      try {
        const pair = await refreshApiTokens(token.apiRefreshToken)
        return {
          ...token,
          apiAccessToken: pair.accessToken,
          apiRefreshToken: pair.refreshToken,
          apiExpiresAt: Date.now() + pair.expiresIn * 1000,
        }
      } catch {
        return null  // Auth.js v5: returning null clears the session
      }
    }
  }
  return token
}
```

`refreshApiTokens` lives in `apps/web/src/lib/auth/refresh.ts` (server-only): a fetch-only POST to `/v1/auth/refresh` with the refresh token, parses the new `TokenPair` via the shared schema.

**Why proactive (not retry-on-401):** Auth.js v5 calls `jwt` on every `auth()` invocation. RSCs read the session once per request; clients read it via `useSession()` periodically. Rotating in `jwt` means every downstream call to `apiFetch(..., { accessToken })` already gets a fresh token — no per-fetch retry logic needed in the common path.

### 4.2 Defensive 401 retry in `apiFetch`

A race exists: the `jwt` callback rotates at `T - 60s`, but a concurrent fetch in flight at `T` could still hit a 401 if the api's clock skews differently. Add a single retry to `apiFetch`:

```ts
if (res.status === 401 && !init?._retried) {
  // Caller's responsibility to provide a fresh token; here we just surface 401
  // and let the calling layer (TanStack Query mutation) re-fetch via session().update()
  ...
}
```

**Decision:** Don't actually retry inside `apiFetch` — let the calling layer handle it. The reason: `apiFetch` doesn't know about the session; baking refresh into it would couple the lib to Auth.js. Instead:

- **Server-side callers (RSC, route handlers):** `getCurrentUser` already calls `auth()` which triggers the `jwt` rotation. Always-fresh token by construction.
- **Client-side callers (TanStack Query):** mutation `mutationFn` reads `session.apiAccessToken` *inside* the function (not closed over). On 401 from a mutation, surface the error; toast ("Session expired, please sign in"). User clicks → re-auth.

This is simpler than retry-on-401 and matches Auth.js v5 idioms. We accept the rare worst-case where a 401 surfaces to the user once.

### 4.3 Sign-out

`<SignOutButton />` (already exists from 7a) needs to also POST `/v1/auth/logout` with the refresh token to revoke it server-side, before calling Auth.js `signOut()`. Idempotent if api is unreachable.

## 5. Data fetching

### 5.1 Server fetchers (extend `apps/web/src/features/`)

```
features/
  catalog/
    catalog-fetchers.ts        ← already exists; add getAllCases
  search/
    search-fetchers.ts         ← server-only; getSearchResults(q, limit)
  me/
    me-fetchers.ts             ← server-only; getMyAlgorithms, getMyAlgorithmFor(caseSlug)
```

All `'server-only'` fenced. Use `apiFetch` with `accessToken` from `getCurrentUser()` for `/me/*`.

### 5.2 Client hooks (TanStack Query)

```
features/
  search/
    use-search.ts              ← client; debounced; { staleTime: 30_000 }
  me/
    use-my-algorithms.ts       ← list, hydrated from RSC; { staleTime: 5_000 }
    use-update-algorithm.ts    ← PUT mutation, optimistic
    use-delete-algorithm.ts    ← DELETE mutation, optimistic
```

Query key factories:

```ts
// features/search/query-keys.ts
export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, limit: number) => ['search', q, limit] as const,
}

// features/me/query-keys.ts
export const meKeys = {
  algorithms: ['me', 'algorithms'] as const,
}
```

### 5.3 RSC → client hydration

Pattern (already used in TanStack Query docs):

```tsx
// /me/algorithms/page.tsx
export default async function Page() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: meKeys.algorithms,
    queryFn: () => getMyAlgorithms(token),
  })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AlgorithmsTable />
    </HydrationBoundary>
  )
}
```

`<AlgorithmsTable />` is `'use client'` and reads via `useMyAlgorithms()` — instant hydrate, no loading flash.

## 6. State management

| Concern | Tool | Where |
|---|---|---|
| Server state (search/me) | TanStack Query | `features/{search,me}/use-*.ts` |
| Command palette open/close | Zustand | `features/command-palette/store.ts` |
| Form state on case page | RHF + zod | inline in `<TrackCaseButton />` (small, no separate file) |
| Theme | `next-themes` (existing) | `<ThemeToggle />` in palette |

## 7. Components

| File | Purpose |
|---|---|
| `components/search/search-input.tsx` | client; debounced; pushes `?q=` to URL |
| `components/search/search-results.tsx` | server (RSC); renders hits |
| `components/command-palette/command-palette.tsx` | client; cmdk dialog |
| `components/command-palette/use-keyboard-shortcut.ts` | client hook for cmd+k |
| `components/track-case/track-case-button.tsx` | client; status dropdown + mutations |
| `components/me/algorithms-table.tsx` | client; shadcn Table + status select + delete |
| `components/me/empty-state.tsx` | empty state for /me/algorithms |
| `lib/auth/refresh.ts` | server-only; `refreshApiTokens(refreshToken)` |
| `lib/api-client.ts` | extend: pass through 401 status (already does) |

shadcn primitives to install:

- `Dialog` (for cmdk wrapper)
- `Command` (cmdk skin)
- `Select` (status dropdown)
- `Table` (algorithms table)
- `Toast`/`Sonner` toaster (already? confirm in 7a)

Run `pnpm dlx shadcn@latest add dialog command select table sonner` if any are missing.

## 8. Routing

```
src/app/
  search/
    page.tsx                                ← RSC, ?q= via searchParams
  me/
    layout.tsx                              ← auth gate
    algorithms/
      page.tsx                              ← RSC + hydrate
  3x3/[method]/[set]/[case]/page.tsx        ← extended w/ <TrackCaseButton />
  layout.tsx                                ← mount <CommandPalette /> globally
```

`/me/*` are NOT in a route group in 7c (we don't have route groups yet; flat layout). Adding `(app)` / `(marketing)` route groups is 7d.

## 9. Testing

Per `070-testing-rule.md`:

- **Unit:** Vitest for `features/search/use-search.ts` debounce behavior; for query key factories.
- **Component:** none in 7c (saved for 7d Storybook + Testing Library).
- **E2E:** none in 7c (saved for 7d Playwright).
- **Manual smoke** (the gate for this sub-phase):
  - Sign in → /me/algorithms shows empty state.
  - Visit `/3x3/cfop/pll/t-perm` → see "Track this case" → mark Learning.
  - Visit `/me/algorithms` → see T-Perm row, status Learning.
  - Change status to Learned via row dropdown → row updates.
  - Delete row → row disappears.
  - Cmd-K → type "tperm" → arrow to T-Perm hit → enter → land on case page.
  - `/search?q=tperm` → 1 hit, link works.
  - Wait 16+ minutes (or simulate by tweaking expiry) → next request still works → confirms refresh path.

## 10. File-level changes summary

```
NEW
  apps/web/src/lib/auth/refresh.ts
  apps/web/src/features/search/{search-fetchers.ts, use-search.ts, query-keys.ts}
  apps/web/src/features/me/{me-fetchers.ts, use-my-algorithms.ts, use-update-algorithm.ts, use-delete-algorithm.ts, query-keys.ts}
  apps/web/src/features/command-palette/store.ts
  apps/web/src/components/search/{search-input.tsx, search-results.tsx}
  apps/web/src/components/command-palette/{command-palette.tsx, use-keyboard-shortcut.ts}
  apps/web/src/components/track-case/track-case-button.tsx
  apps/web/src/components/me/{algorithms-table.tsx, empty-state.tsx}
  apps/web/src/app/search/page.tsx
  apps/web/src/app/me/layout.tsx
  apps/web/src/app/me/algorithms/page.tsx
  apps/web/src/components/ui/{dialog,command,select,table,sonner}.tsx  (via shadcn add)

MODIFIED
  apps/web/src/lib/auth/auth.config.ts                  ← jwt callback rotation
  apps/web/src/app/layout.tsx                           ← mount <CommandPalette />, <Toaster />
  apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx   ← <TrackCaseButton /> when authed
  apps/web/src/features/auth/sign-out-button.tsx        ← POST /v1/auth/logout before signOut()
  apps/web/src/features/catalog/catalog-fetchers.ts     ← getAllCases
```

## 11. Risk register

| Risk | Mitigation |
|---|---|
| `jwt` callback rotation doesn't fire on subsequent reads (only sign-in) | Verify in 7a's existing implementation; if false, fall back to retry-on-401 + `unstable_update` from a server action. |
| Optimistic update + 401 race causes ghost rows | Mutation reads `session.apiAccessToken` inside `mutationFn`; on 401 surface error and let user re-auth. |
| Search debounce + URL push spams history | Use `router.replace` (not `push`); debounce on the URL push as well, not just the api call. |
| `cmdk` Dialog + Auth.js session interaction (server/client mismatch on hydration of static commands) | Compute "authed" once on the server, pass as prop; do not read `useSession()` inside the palette. |
| `getAllCases` fetch on every /me/algorithms render is wasteful | `staleTime: Infinity` since case identity is immutable; cache lives across navigations. |
| Status dropdown mid-edit while api response in-flight | Disable the row's `<Select>` while mutation is pending; re-enable on settle. |

## 12. Done-when

- [ ] `/search?q=t-perm` returns 1 hit and clicking it lands on the case page.
- [ ] ⌘K opens a palette anywhere on the site; typing fires search; static commands work.
- [ ] `/me/algorithms` is gated; signed-in empty state shows; tracked case appears after marking.
- [ ] Status dropdown on a tracked row PUTs and the table updates optimistically.
- [ ] Delete on a tracked row DELETEs and the row disappears optimistically.
- [ ] Case page shows "Track this case" only when authed; full CRUD round-trips work.
- [ ] Sign-out POSTs `/v1/auth/logout` before clearing Auth.js session.
- [ ] Token rotation runs at < 60s before expiry; verified by manual smoke after a long idle.
- [ ] `pnpm --filter @rubik/web typecheck && lint && build` clean (api running for SSG).
- [ ] All commits follow lowercase Conventional Commits with scope `web` (or `auth` for 4.x).
