# Plan 07 sub-phase 7b — web catalog browsing

**Plan:** [`07-apps-web.md`](2026-04-25-implementation/07-apps-web.md). Sub-phase 7b — second of four (7a foundation+auth ✓, 7b catalog, 7c /me+search, 7d closing).
**Master design refs:** §19.2 (web tree + routes), §19.3 (catalog rendering), §19.6 (visualizer integration), §020 (styling), §010 (RSC patterns).
**Predecessors:** plan 07 sub-phase 7a on main (foundation + auth + landing). Plan 04a on main (visualizer SVG views). Api on :3001 with seeded content.
**Branch:** `plan-07b-web-catalog`.

## Problem & goal

7a left the web with a sign-in landing page that displays the user. The api serves real seeded data through `/v1/puzzles`, `/v1/sets/:slug`, etc. — but no web route consumes it yet. 7b ships the catalog browsing surface: four routes (`/3x3`, `/3x3/[method]`, `/3x3/[method]/[set]`, `/3x3/[method]/[set]/[case]`), all RSC + SSG, the case page rendering the appropriate `@rubik/visualizer/ssr` SVG view based on `recognition_basis`.

Smoke gate: navigate the full chain `/` → `/3x3` → `/3x3/cfop` → `/3x3/cfop/pll` → `/3x3/cfop/pll/t-perm` and see real data + a real T-Perm SVG diagram.

## Decisions (from brainstorm)

1. **Four routes ship together.** Sub-phase 7b doesn't decompose further — the four catalog levels are a single coherent navigation chain.
2. **All RSC + SSG with `revalidate = 600`.** `generateStaticParams` reads the api at build time. v1 corpus is 14 leaf pages total (1 puzzle × 1 method × 3 sets × 9 cases + 1 puzzle hub).
3. **Case page is SVG-only.** 3D `<Visualizer />` is plan 04b which is deferred. `client.ts` re-exporting SSR keeps the import shape stable for downstream.
4. **`<CubeStateDiagram />` dispatches by `recognition_basis`.** PLL → PLLView, OLL → OLLView, F2L → F2LView, others (LAST_LAYER, CROSS, OTHER) → TopView fallback.
5. **`<SiteHeader />` lives in root layout.** All routes (landing, login, catalog) get the nav. Auth state via `getCurrentUser` server-side.
6. **No new shared schemas needed.** `AlgorithmSetWithCasesSchema` and `AlgorithmCaseWithVariantsSchema` already exist in `@rubik/shared` per sub-phase 3 work.
7. **Catalog routes are public.** No auth gate — they read `@PublicCacheable` api endpoints. Auth state is display-only via the header.
8. **Search/⌘K, /me, /timer, embed, SEO defer to 7c-d.**

## Architecture

### File layout

```
apps/web/src/
├── app/
│   ├── 3x3/
│   │   ├── page.tsx                                puzzle hub — list methods
│   │   ├── not-found.tsx                           shared 404 for the catalog tree
│   │   └── [method]/
│   │       ├── page.tsx                            method (list sets)
│   │       └── [set]/
│   │           ├── page.tsx                        set (case grid)
│   │           └── [case]/
│   │               └── page.tsx                    case page
│   ├── layout.tsx                                  (modified) mount <SiteHeader />
│   └── page.tsx                                    (modified) drop "or visit /login" link
├── components/
│   ├── layout/
│   │   └── site-header.tsx                         logo + nav + auth state (server component)
│   ├── algorithm/
│   │   ├── method-card.tsx
│   │   ├── set-card.tsx
│   │   ├── case-card.tsx                           CubeStateDiagram thumbnail + name
│   │   ├── case-grid.tsx                           responsive grid of CaseCards
│   │   └── variant-list.tsx                        primary first, alternates after
│   └── cube/
│       └── cube-state-diagram.tsx                  picks SVG view by recognition_basis
├── features/catalog/
│   └── catalog-fetchers.ts                         server-side apiFetch wrappers
└── lib/
    └── markdown.tsx                                react-markdown wrapper with sanitize
```

### Dependency direction

- All catalog routes are server components.
- `@rubik/shared` provides every schema we consume (`PuzzleSchema`, `MethodSchema`, `AlgorithmSetSchema`, `AlgorithmSetWithCasesSchema`, `AlgorithmCaseSchema`, `AlgorithmCaseWithVariantsSchema`, `AlgorithmVariantSchema`, `RecognitionBasisSchema`).
- `@rubik/visualizer/ssr` provides `TopView`, `PLLView`, `OLLView`, `F2LView`.
- `apiFetch` from `lib/api-client` (uses `publicEnv.NEXT_PUBLIC_API_URL`; works for SSG at build time and runtime ISR).
- No new external deps — `react-markdown`, `remark-gfm`, `rehype-sanitize` already preinstalled in 7a.

### `<CubeStateDiagram />` dispatcher

Server component — no hooks, RSC-safe.

```ts
interface CubeStateDiagramProps {
  caseState: string
  recognitionBasis: RecognitionBasis
  size?: number
  title?: string
  className?: string
}
```

Switch on `recognitionBasis`:

| `recognitionBasis` | View |
|---|---|
| `PLL_PERMUTATION` | `<PLLView />` |
| `OLL_ORIENTATION` | `<OLLView />` |
| `F2L_SLOT` | `<F2LView />` |
| `LAST_LAYER`, `CROSS`, `OTHER` | `<TopView />` (fallback) |

### Routes

**`/3x3` — puzzle hub**

```ts
export const revalidate = 600

export default async function PuzzlePage() {
  const methods = await getMethods('3x3')
  return (
    <main className="container py-12">
      <h1 className="text-3xl font-bold mb-6">3x3 — Methods</h1>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {methods.map((m) => <MethodCard key={m.slug} method={m} />)}
      </ul>
    </main>
  )
}
```

(No `generateStaticParams` — `/3x3` itself is static, no params.)

**`/3x3/[method]` — method overview**

`generateStaticParams` reads `/v1/puzzles/3x3/methods` and returns `[{ method: 'cfop' }, ...]`. The page reads `/v1/puzzles/3x3/methods/cfop/sets` and lists sets via `<SetCard />`.

**`/3x3/[method]/[set]` — catalog grid**

`generateStaticParams` reads each method's sets and returns the cross-product. Page reads `/v1/sets/[set]` (which returns the set + nested cases) and renders `<CaseGrid>` of `<CaseCard>`s.

**`/3x3/[method]/[set]/[case]` — case page**

`generateStaticParams` reads each set's cases and returns the cross-product. Page reads `/v1/cases/[case]` (case + variants), renders:
- Header: case name + breadcrumb (Method / Set / Case)
- Hero: large `<CubeStateDiagram size={320} />`
- Recognition copy: `<Markdown source={case.recognitionMd} />`
- Variants: `<VariantList variants={case.variants} />`

### `<SiteHeader />`

Server component. Renders sticky top nav with three regions:
- Left: "rubik-algorithm" logo (Link to `/`)
- Center: "Catalog" Link to `/3x3`
- Right: auth-aware area
  - signed-in: `<span>{user.displayName ?? user.email}</span> <SignOutButton />`
  - signed-out: `<SignInButton callbackUrl={pathname} />` (callbackUrl deferred to 7c when refresh-on-401 lands; for 7b just `'/'`)

Calls `getCurrentUser()` server-side. Mounted in root layout above `{children}`. The current `<Toaster />` stays in root layout.

### Data fetching

`features/catalog/catalog-fetchers.ts`:

```ts
import 'server-only'

import {
  AlgorithmCaseWithVariantsSchema,
  AlgorithmSetSchema,
  AlgorithmSetWithCasesSchema,
  MethodSchema,
  PuzzleSchema,
  type AlgorithmCaseWithVariants,
  type AlgorithmSet,
  type AlgorithmSetWithCases,
  type Method,
  type Puzzle,
} from '@rubik/shared'
import { z } from 'zod'

import { apiFetch } from '@/lib/api-client'

export const getPuzzles = (): Promise<Puzzle[]> =>
  apiFetch('/v1/puzzles', z.array(PuzzleSchema))

export const getMethods = (puzzleSlug: string): Promise<Method[]> =>
  apiFetch(`/v1/puzzles/${puzzleSlug}/methods`, z.array(MethodSchema))

export const getSets = (puzzleSlug: string, methodSlug: string): Promise<AlgorithmSet[]> =>
  apiFetch(
    `/v1/puzzles/${puzzleSlug}/methods/${methodSlug}/sets`,
    z.array(AlgorithmSetSchema),
  )

export const getSetWithCases = (setSlug: string): Promise<AlgorithmSetWithCases> =>
  apiFetch(`/v1/sets/${setSlug}`, AlgorithmSetWithCasesSchema)

export const getCaseWithVariants = (caseSlug: string): Promise<AlgorithmCaseWithVariants> =>
  apiFetch(`/v1/cases/${caseSlug}`, AlgorithmCaseWithVariantsSchema)
```

`'server-only'` per §010.

### Markdown wrapper

`lib/markdown.tsx`:

```tsx
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  source: string
  className?: string
}

export const Markdown = ({ source, className }: MarkdownProps) => (
  <div className={className}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        h1: ({ children }) => <h1 className="text-2xl font-bold my-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-semibold my-3">{children}</h2>,
        p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
        code: ({ children }) => <code className="font-mono bg-muted px-1 rounded">{children}</code>,
        ul: ({ children }) => <ul className="list-disc pl-6 my-2">{children}</ul>,
      }}
    >
      {source}
    </ReactMarkdown>
  </div>
)
```

### Card components

All are `<Link>`-wrapped tiles with semantic-token styling (`bg-card text-card-foreground border border-border hover:bg-accent`).

- **MethodCard** — name + (truncated) descriptionMd; Link to `/3x3/[method]`
- **SetCard** — name + caseCountExpected + recognitionBasis badge; Link to `/3x3/[method]/[set]`
- **CaseCard** — `<CubeStateDiagram size={120} />` + name; Link to `/3x3/[method]/[set]/[case]`
- **CaseGrid** — responsive grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4`
- **VariantList** — primary variant highlighted; alternates listed after with attribution + collapsible fingertrick_md (use native `<details>` for v1; shadcn Accordion is 7d polish)

## Errors

- Invalid puzzle/method/set/case slug → Next's automatic 404 via `notFound()` from `next/navigation`. Each page wraps the fetcher in try/catch and calls `notFound()` on `ApiError` with `status: 404`.
- `/3x3/not-found.tsx` provides a friendlier 404 page for the catalog tree.

```ts
import { ApiError } from '@/lib/api-client'

try {
  const data = await getCaseWithVariants(slug)
  // ...
} catch (err) {
  if ((err as ApiError).status === 404) notFound()
  throw err
}
```

## Configuration

No new env vars. Uses `NEXT_PUBLIC_API_URL` from `lib/env.client.ts` (already wired in 7a).

## Smoke gate

Manual smoke checklist after the sub-phase lands:

```bash
make dev.api    # api on :3001 with seeded content
pnpm --filter @rubik/web dev    # web on :3000
```

In a browser:
1. `http://localhost:3000` — site header visible (logo + Catalog link + sign-in CTA)
2. `http://localhost:3000/3x3` — "CFOP" method card linking to `/3x3/cfop`
3. `http://localhost:3000/3x3/cfop` — three set cards (F2L, OLL, PLL) with their case_count_expected
4. `http://localhost:3000/3x3/cfop/pll` — three case cards with thumbnail SVG diagrams (T-Perm, Aa-Perm, Ab-Perm)
5. `http://localhost:3000/3x3/cfop/pll/t-perm` — large PLLView diagram + recognition copy + primary variant notation
6. `http://localhost:3000/3x3/cfop/pll/zzzz` — 404 not-found page (friendly)
7. Visual: SVG diagrams render correctly with WCA colors at all sizes (thumbnail + hero)
8. Cli: `pnpm --filter @rubik/web typecheck && lint && build` clean
9. Bundle: total First Load JS still under §19.9's 200kb gzipped target

Build smoke specifically asserts SSG worked: `pnpm --filter @rubik/web build` should report ≥14 static pages (1 puzzle hub + 1 method + 3 sets + 9 cases + landing + login + 404 + auth handler).

## Done when

- [ ] Four catalog routes ship + 404 page
- [ ] `<SiteHeader />` mounted in root layout; landing page reflows
- [ ] `<CubeStateDiagram />` correctly dispatches by `recognition_basis`
- [ ] `<Markdown />` wraps react-markdown with remark-gfm + rehype-sanitize
- [ ] Catalog fetchers cover all needed endpoints; `'server-only'` fenced
- [ ] All routes use `export const revalidate = 600` and `generateStaticParams` where applicable
- [ ] `pnpm --filter @rubik/web typecheck && lint && build` clean
- [ ] Smoke checklist 1-9 verified locally
- [ ] Commits follow lowercase Conventional Commits with scope `web`

## Out of scope (deferred)

- `/search` + ⌘K palette — 7c
- `/me/algorithms` and any auth-gated routes — 7c
- Refresh-on-401 logic — 7c
- `/timer` — 7d
- `/embed/visualizer` — 7d
- SEO (sitemap, robots, JSON-LD HowTo, opengraph-image) — 7d
- Per-case dynamic OG image — 7d
- Sentry instrumentation — 7d
- Storybook — 7d
- Playwright e2e — 7d
- Lighthouse budget tuning — 7d
- 3D Visualizer integration — gated on plan 04b
- Mobile-optimized nav (hamburger menu) — 7d
- shadcn Accordion / Card / Badge primitives — install per-component as needed in this sub-phase
- Search/filter/sort within the catalog grid — defer until corpus grows past ~50 cases
- Recognition images (photos) — content backlog (separate from plan 07)

## Forward-compat notes

- `<CubeStateDiagram />`'s API is stable; 04b's 3D `<Visualizer />` will be a sibling component the case page imports lazily via `next/dynamic({ ssr: false })`. The SVG path stays as the SSR thumbnail + initial paint.
- `<SiteHeader />` is bare-bones in 7b. 7c can add a search trigger (⌘K) to the center area; 7d can add the dark/light toggle and mobile menu.
- `catalog-fetchers.ts` will be reused unchanged in 7c (`/me/algorithms` joins case rows fetched here with the user's progress rows fetched separately).
