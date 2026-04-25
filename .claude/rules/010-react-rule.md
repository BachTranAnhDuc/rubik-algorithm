# React + Next.js Conventions

`apps/web` is Next.js 15 (App Router) + React 19. The visualizer (`packages/visualizer`) ships React components too; same rules apply.

## Server vs client split

- **Default to Server Components.** Only add `"use client"` when the component needs hooks, event handlers, refs, browser APIs, or third-party client libraries (three.js, motion, cmdk, etc.).
  - Why: catalog pages are content. Moving them to the client ships JS for nothing and fights streaming.
- **`"use client"` is the first line of the file.** No imports above it.
  - Why: Next's loader reads the directive before the module; misplacement is silently ignored.
- **Server-only modules fence with `import "server-only";`.** The api client used by RSC, the env loader, the auth helper — all server-only.
  - Why: an accidental import from a client component becomes a build error, not a runtime leak.
- **Don't pass non-serializable props from server to client.** Functions, class instances, `Date` (use ISO strings at the boundary).
  - Why: serialization fails at runtime with a cryptic error; fix at the boundary.
- **Server components can be `async`** — pages, layouts, slots. Awaiting `params`/`searchParams` is required:
  ```ts
  export const Page = async ({ params }: { params: Promise<{ method: string }> }) => {
    const { method } = await params
  }
  ```
  - Why: since Next 15, `params`/`searchParams` are Promises; sync destructuring breaks under Turbopack.

## Routing (App Router)

- **All routes live under `apps/web/src/app/`.** No `pages/`. Route groups `(app)`, `(marketing)`, `(auth)` carry layouts without affecting URLs (§19.3).
  - Why: layouts, metadata, and middleware all assume the App Router shape.
- **Catalog pages are SSG with on-demand revalidation.** `export const revalidate = 600` plus a webhook revalidator for content changes.
  - Why: SEO is the growth engine (§19.8); content rarely changes; static HTML is the cheapest, fastest path.
- **Typed routes via `experimental.typedRoutes`.** `<Link href="/3x3/cfop/pll">` is type-checked.
  - Why: rename a route, every dead `Link` becomes a type error.

## State management

- **Server state → TanStack Query.** Used selectively for mutations and client-side reads on `/me/*`. Keys via factory: `caseKeys.detail(slug)`.
  - Why: keys-as-deps replaces effect orchestration; key factories prevent typos and stale-key bugs.
- **`staleTime` is the lever you adjust most.** Catalog reads default to a long `staleTime` (matches HTTP `s-maxage`). User mutations stay default (instantly stale).
  - Why: instant-stale is React Query's default; without bumping `staleTime` for read-mostly catalog data you re-fetch on every focus and waste bandwidth.
- **Don't `useState` with data from `useQuery`.** Read straight from the hook; if you must (form initialization), `staleTime: Infinity`.
  - Why: copying server state to local state breaks background updates — the value you display goes stale silently.
- **`enabled` for dependent and conditional queries.** Disable until prerequisites are met.
  - Why: avoids fetching with `undefined` params and hides loading flicker on dependent chains.
- **Hydrate via `<HydrationBoundary>`.** RSC fetches → `dehydrate(queryClient)` → boundary in the client tree.
  - Why: SSR-fetched data is shown immediately; the client query is already populated and won't re-fetch.
- **Client state → Zustand.** Used for the timer state machine and visualizer playback. `persist` middleware for localStorage of last-N times.
  - Why: server state and client state are different problems; mixing them in one store is the classic anti-pattern.
- **Forms → React Hook Form + zod resolver.** Schemas come from `packages/shared`.
  - Why: shadcn's `<Form>` is built on RHF; same zod schema validates both sides of the boundary.

## Hooks

- **Hook ordering:** state → refs → memoized derived values → effects → callbacks → return.
  - Why: matches React's deps-tracking direction; makes review predictable.
- **`useMemo`/`useCallback` only when a child's identity matters** (memoized child, context value, deps array). Don't sprinkle for "perf".
  - Why: React 19 is fast; premature memoization hides real cost centers and adds a deps maintenance tax.
- **Context value objects must be `useMemo`'d.**
  - Why: without it every provider render re-renders every consumer.
- **Custom hooks start with `use`.** Live in `apps/web/src/features/<area>/hooks.ts` or `<area>/use-<thing>.ts` for area-scoped hooks.
  - Why: `use` prefix is what rules-of-hooks lints rely on; the location hints scope.
- **Throw on misuse of a context hook.** A `useCurrentUser()` outside `<AuthProvider>` should throw, not return `undefined`.
  - Why: a loud dev-time error beats a silent crash three stacks deeper.

## Component shape

- **Files are kebab-case (`case-card.tsx`), components are PascalCase (`CaseCard`), hooks are `use-*.ts`.**
  - Why: matches `eslint-config-next` and what every other file already uses.
- **One primary export per file.** Bundled UI primitives (e.g., shadcn's `<Form>`, `<FormField>`, `<FormItem>`) are the deliberate exception.
  - Why: grep-ability; imports stay self-describing.
- **Use `React.HTMLAttributes<T>` (or `React.ComponentProps<typeof X>`) for pass-through props.** Extend with `& { ... }`.
  - Why: keeps `className`, `aria-*`, `data-*`, refs working without hand-listing.
- **Forward `className` and merge with `cn()`** from `apps/web/src/lib/cn.ts`.
  - Why: Tailwind's last-write-wins needs `tailwind-merge` to resolve conflicts.
- **Default to data-fetching in Server Components, mutations in Client Components.** Don't fetch in `useEffect`.
  - Why: RSC is the right place for read-fetching; `useEffect` for fetching is the legacy pattern Query and RSC together replace.

## Visualizer integration

- **Import the SSR build** (`@rubik/visualizer/ssr`) from Server Components — pure SVG, zero hydration.
  - Why: 21 PLLs in a grid as 3D scenes would tank LCP. SVG diagrams are free (§20.2).
- **Import the client build via `next/dynamic` with `ssr: false`** for the case page's interactive 3D.
  - Why: three.js cannot SSR; `dynamic({ ssr: false })` makes the runtime split explicit and lazy.

## Auth.js v5 + api JWT

- **Auth.js handles only the Google handshake.** `signIn` callback POSTs the Google ID token to api `/v1/auth/google`; the api owns user persistence.
  - Why: api is the source of truth (§18.4). Web doesn't write to Postgres.
- **Api access JWT in an httpOnly, Secure, SameSite=Lax cookie.** Web reads the cookie server-side and forwards as `Authorization: Bearer …`.
  - Why: tokens never reach client JS; XSS doesn't steal sessions.
- **`getCurrentUser()` server helper for RSC.** Use `useSession()` only in client components that need to react to login state.
  - Why: server helper is faster (no client roundtrip) and works in async server components.

## Metadata & SEO

- **`generateMetadata({ params })` per route** emits title/description/canonical/OG. Awaits `params`.
  - Why: same Promise-params rule.
- **Case page emits JSON-LD `schema.org/HowTo`** (steps = moves) for rich Google results.
  - Why: structured data is the cheapest visibility upgrade for an algorithm corpus.
- **`app/sitemap.ts` calls api `/v1/sitemap`** at build to enumerate every case URL.
  - Why: catalog grows over time; hand-maintained sitemaps go stale.
- **Dynamic per-case OG via `opengraph-image.tsx`** co-located with the case route — renders the cube state.
  - Why: free `next/og` capability turns a state string into a shareable image.

## Fonts & assets

- **Fonts via `next/font/google`** (Inter + JetBrains Mono); forward CSS variables to `<html>`.
  - Why: self-hosted, zero CLS, no privacy cost from Google-hosted fonts.
- **Bitmap images via `next/image`.** Set `width`/`height` (or `fill` with a sized parent) and `alt`.
  - Why: layout shift + lazy loading + format negotiation are the point.
- **Public assets in `public/`** with root-absolute paths (`/og.png`).
  - Why: the browser wants a URL, not a module.
