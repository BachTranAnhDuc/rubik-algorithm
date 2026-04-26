# Plan 07 sub-phase 7b — Implementation plan (catalog browsing)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four RSC + SSG catalog routes (`/3x3`, `/3x3/[method]`, `/3x3/[method]/[set]`, `/3x3/[method]/[set]/[case]`) so navigating from `/` to T-Perm renders real seeded data with a real PLL SVG diagram.

**Architecture:** Server components everywhere. `generateStaticParams` reads the api at build time; `revalidate = 600` enables ISR. `<CubeStateDiagram />` dispatches `recognition_basis` → `@rubik/visualizer/ssr` view. `<SiteHeader />` in the root layout exposes auth state via `getCurrentUser`. `<Markdown />` wraps `react-markdown` with `remark-gfm` + `rehype-sanitize` for `recognition_md`. No new external deps; `react-markdown`, `remark-gfm`, `rehype-sanitize` were preinstalled in 7a. No new shared schemas; composites (`AlgorithmSetWithCasesSchema`, `AlgorithmCaseWithVariantsSchema`) exist in `@rubik/shared`.

**Tech Stack:** Next.js 15 (App Router, RSC, SSG, ISR), `@rubik/shared` (zod schemas), `@rubik/visualizer/ssr` (PLLView, OLLView, F2LView, TopView), `react-markdown` + `remark-gfm` + `rehype-sanitize`, Tailwind v4 (semantic tokens), shadcn Button (already vendored).

**Spec:** [`docs/plans/2026-04-25-web-sub-phase-7b-design.md`](2026-04-25-web-sub-phase-7b-design.md) (commit `79a9886`)

---

## Pre-flight

- [ ] **Step 1: Confirm working directory and branch**

Run: `git -C /home/ducbach/Documents/study/rubik-algorithm rev-parse --abbrev-ref HEAD && git -C /home/ducbach/Documents/study/rubik-algorithm log --oneline -3`

Expected: branch `plan-07b-web-catalog`; latest commit is `79a9886 docs(plans): add web sub-phase 7b design (catalog browsing)`.

- [ ] **Step 2: Confirm api is running with seeded content**

Run:

```bash
curl -s http://localhost:3001/v1/puzzles | jq -c '.[0]'
curl -s http://localhost:3001/v1/sets/pll | jq -c '{slug, caseCount: .cases | length}'
```

Expected: returns `3x3` puzzle and `pll` set with `caseCount: 3`. If api isn't running, `make dev.api` in another terminal first.

- [ ] **Step 3: Confirm 7a quality gates still pass at HEAD**

Run from repo root:

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
```

Expected: clean. (Build is a Task 13 responsibility — needs the api running for `generateStaticParams`.)

---

## Task 1: `<Markdown />` wrapper

**Files:**
- Create: `apps/web/src/lib/markdown.tsx`

`react-markdown` + `remark-gfm` + `rehype-sanitize` wrapper. Custom element overrides for headings, paragraphs, code, lists. Used for `recognition_md` (and later `personal_notes_md` in 7c).

- [ ] **Step 1.1: Create `apps/web/src/lib/markdown.tsx`**

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
        h1: ({ children }) => <h1 className="my-4 text-2xl font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="my-3 text-xl font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="my-2 text-lg font-semibold">{children}</h3>,
        p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
        code: ({ children }) => (
          <code className="rounded bg-muted px-1 font-mono text-sm">{children}</code>
        ),
        ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
        li: ({ children }) => <li className="my-1">{children}</li>,
        a: ({ children, href }) => (
          <a className="text-primary underline-offset-4 hover:underline" href={href}>
            {children}
          </a>
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  </div>
)
```

- [ ] **Step 1.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add apps/web/src/lib/markdown.tsx
git commit -m "$(cat <<'EOF'
feat(web): add markdown wrapper with sanitize + gfm

Wraps react-markdown with remark-gfm + rehype-sanitize. Custom element
overrides apply Tailwind classes via the components prop (no
@tailwindcss/typography needed). Used for recognition_md on the case
page; will also serve personal_notes_md in 7c.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Catalog fetchers

**Files:**
- Create: `apps/web/src/features/catalog/catalog-fetchers.ts`

Server-side `apiFetch` wrappers for the five catalog endpoints. `'server-only'` fenced.

- [ ] **Step 2.1: Create `apps/web/src/features/catalog/catalog-fetchers.ts`**

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

export const getSets = (
  puzzleSlug: string,
  methodSlug: string,
): Promise<AlgorithmSet[]> =>
  apiFetch(
    `/v1/puzzles/${puzzleSlug}/methods/${methodSlug}/sets`,
    z.array(AlgorithmSetSchema),
  )

export const getSetWithCases = (setSlug: string): Promise<AlgorithmSetWithCases> =>
  apiFetch(`/v1/sets/${setSlug}`, AlgorithmSetWithCasesSchema)

export const getCaseWithVariants = (
  caseSlug: string,
): Promise<AlgorithmCaseWithVariants> =>
  apiFetch(`/v1/cases/${caseSlug}`, AlgorithmCaseWithVariantsSchema)
```

- [ ] **Step 2.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/src/features/catalog/catalog-fetchers.ts
git commit -m "$(cat <<'EOF'
feat(web): add catalog fetchers for the public api endpoints

Five server-only fetchers covering /v1/puzzles, /v1/puzzles/:p/methods,
/v1/puzzles/:p/methods/:m/sets, /v1/sets/:slug, /v1/cases/:slug. Each
wraps apiFetch with the shared zod schema for response validation.
Catalog endpoints are @PublicCacheable on the api side, so no auth
needed; ISR/SSG + s-maxage handles caching.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `<CubeStateDiagram />` dispatcher

**Files:**
- Create: `apps/web/src/components/cube/cube-state-diagram.tsx`

Server component. Picks the right `@rubik/visualizer/ssr` view based on `recognitionBasis`.

- [ ] **Step 3.1: Create `apps/web/src/components/cube/cube-state-diagram.tsx`**

```tsx
import {
  F2LView,
  OLLView,
  PLLView,
  TopView,
} from '@rubik/visualizer/ssr'
import type { RecognitionBasis } from '@rubik/shared'

interface CubeStateDiagramProps {
  caseState: string
  recognitionBasis: RecognitionBasis
  size?: number
  title?: string
  className?: string
}

export const CubeStateDiagram = ({
  caseState,
  recognitionBasis,
  size,
  title,
  className,
}: CubeStateDiagramProps) => {
  const props = {
    state: caseState,
    ...(size !== undefined ? { size } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(className !== undefined ? { className } : {}),
  }
  switch (recognitionBasis) {
    case 'PLL_PERMUTATION':
      return <PLLView {...props} />
    case 'OLL_ORIENTATION':
      return <OLLView {...props} />
    case 'F2L_SLOT':
      return <F2LView {...props} />
    case 'LAST_LAYER':
    case 'CROSS':
    case 'OTHER':
      return <TopView {...props} />
  }
}
```

(The conditional spreads handle `exactOptionalPropertyTypes` — same pattern as Task 6's api-client deviation.)

- [ ] **Step 3.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/src/components/cube/cube-state-diagram.tsx
git commit -m "$(cat <<'EOF'
feat(web): add CubeStateDiagram dispatcher

Server component that selects the right SVG view from
@rubik/visualizer/ssr based on the set's recognition_basis:
PLL_PERMUTATION → PLLView, OLL_ORIENTATION → OLLView, F2L_SLOT →
F2LView, others (LAST_LAYER, CROSS, OTHER) → TopView fallback. Used
by case cards (thumbnail) and the case page (hero diagram). The 3D
Visualizer integration is gated on plan 04b; this is the SVG-only
path that ships in 7b.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `<SiteHeader />` + mount in root layout

**Files:**
- Create: `apps/web/src/components/layout/site-header.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`

Server component header with auth state. Mounts in root layout. Landing page sheds the redundant `<a href="/login">` since the header now carries the sign-in CTA.

- [ ] **Step 4.1: Create `apps/web/src/components/layout/site-header.tsx`**

```tsx
import Link from 'next/link'

import { SignInButton } from '@/features/auth/sign-in-button'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { getCurrentUser } from '@/lib/auth/session'

export const SiteHeader = async () => {
  const user = await getCurrentUser()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold">
          rubik-algorithm
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/3x3" className="text-sm font-medium hover:underline">
            Catalog
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.displayName ?? user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4.2: Modify `apps/web/src/app/layout.tsx` to mount the header**

Read the file first, then update. The existing layout wraps children with `<RootProviders>` and `<Toaster />`. Add `<SiteHeader />` above `{children}`:

```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

import { SiteHeader } from '@/components/layout/site-header'
import { RootProviders } from '@/providers/root-providers'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'rubik-algorithm',
  description:
    'A learnable, searchable, trackable algorithm corpus for the speedcubing community.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <RootProviders>
          <SiteHeader />
          {children}
          <Toaster richColors position="top-right" />
        </RootProviders>
      </body>
    </html>
  )
}
```

- [ ] **Step 4.3: Modify `apps/web/src/app/page.tsx` to drop the redundant link**

Read the file first. Remove the `<Button variant="link" asChild><a href="/login">Or visit /login directly</a></Button>` block — the header carries the sign-in CTA now. The signed-in branch (welcome + sign-out) also becomes simpler since the header has them. Final shape:

```tsx
import { getCurrentUser } from '@/lib/auth/session'

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">rubik-algorithm</h1>
      {user ? (
        <p className="max-w-md text-center text-xl">
          Welcome back. Browse the{' '}
          <a href="/3x3" className="text-primary underline-offset-4 hover:underline">
            CFOP catalog
          </a>{' '}
          to track what you&apos;re learning.
        </p>
      ) : (
        <p className="max-w-md text-center text-muted-foreground">
          The CFOP algorithm corpus, learnable and trackable.
        </p>
      )}
    </main>
  )
}
```

(`min-h-[calc(100vh-3.5rem)]` accounts for the 14-unit-tall header.)

- [ ] **Step 4.4: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/components/layout/site-header.tsx apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SiteHeader and mount in root layout

Server component header — logo, Catalog link, auth-aware area
(signed-in user displayName + sign-out button, signed-out shows
sign-in button). Mounted above {children} in root layout so every
route gets the nav. Landing page sheds the redundant /login link
since the header now carries the auth CTA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Catalog presentation components

**Files:**
- Create: `apps/web/src/components/algorithm/method-card.tsx`
- Create: `apps/web/src/components/algorithm/set-card.tsx`
- Create: `apps/web/src/components/algorithm/case-card.tsx`
- Create: `apps/web/src/components/algorithm/case-grid.tsx`
- Create: `apps/web/src/components/algorithm/variant-list.tsx`

All are RSC presentation components.

- [ ] **Step 5.1: Create `apps/web/src/components/algorithm/method-card.tsx`**

```tsx
import Link from 'next/link'
import type { Method } from '@rubik/shared'

interface MethodCardProps {
  method: Method
  puzzleSlug: string
}

export const MethodCard = ({ method, puzzleSlug }: MethodCardProps) => (
  <li>
    <Link
      href={`/${puzzleSlug}/${method.slug}`}
      className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
    >
      <h3 className="text-lg font-semibold">{method.name}</h3>
      {method.descriptionMd ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {method.descriptionMd}
        </p>
      ) : null}
    </Link>
  </li>
)
```

- [ ] **Step 5.2: Create `apps/web/src/components/algorithm/set-card.tsx`**

```tsx
import Link from 'next/link'
import type { AlgorithmSet } from '@rubik/shared'

interface SetCardProps {
  set: AlgorithmSet
  puzzleSlug: string
  methodSlug: string
}

export const SetCard = ({ set, puzzleSlug, methodSlug }: SetCardProps) => (
  <li>
    <Link
      href={`/${puzzleSlug}/${methodSlug}/${set.slug}`}
      className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
    >
      <h3 className="text-lg font-semibold">{set.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {set.caseCountExpected} cases
      </p>
    </Link>
  </li>
)
```

- [ ] **Step 5.3: Create `apps/web/src/components/algorithm/case-card.tsx`**

```tsx
import Link from 'next/link'
import type { AlgorithmCase, RecognitionBasis } from '@rubik/shared'

import { CubeStateDiagram } from '@/components/cube/cube-state-diagram'

interface CaseCardProps {
  case: AlgorithmCase
  recognitionBasis: RecognitionBasis
  puzzleSlug: string
  methodSlug: string
  setSlug: string
}

const THUMBNAIL_SIZE = 120

export const CaseCard = ({
  case: c,
  recognitionBasis,
  puzzleSlug,
  methodSlug,
  setSlug,
}: CaseCardProps) => (
  <li>
    <Link
      href={`/${puzzleSlug}/${methodSlug}/${setSlug}/${c.slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground transition-colors hover:bg-accent"
    >
      <CubeStateDiagram
        caseState={c.caseState}
        recognitionBasis={recognitionBasis}
        size={THUMBNAIL_SIZE}
        title={c.displayName}
      />
      <span className="text-sm font-medium">{c.displayName}</span>
    </Link>
  </li>
)
```

(`case` is a TypeScript reserved word, so destructured as `case: c`.)

- [ ] **Step 5.4: Create `apps/web/src/components/algorithm/case-grid.tsx`**

```tsx
import type { AlgorithmCase, RecognitionBasis } from '@rubik/shared'

import { CaseCard } from './case-card'

interface CaseGridProps {
  cases: AlgorithmCase[]
  recognitionBasis: RecognitionBasis
  puzzleSlug: string
  methodSlug: string
  setSlug: string
}

export const CaseGrid = ({
  cases,
  recognitionBasis,
  puzzleSlug,
  methodSlug,
  setSlug,
}: CaseGridProps) => (
  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {cases.map((c) => (
      <CaseCard
        key={c.slug}
        case={c}
        recognitionBasis={recognitionBasis}
        puzzleSlug={puzzleSlug}
        methodSlug={methodSlug}
        setSlug={setSlug}
      />
    ))}
  </ul>
)
```

- [ ] **Step 5.5: Create `apps/web/src/components/algorithm/variant-list.tsx`**

```tsx
import type { AlgorithmVariant } from '@rubik/shared'

interface VariantListProps {
  variants: AlgorithmVariant[]
}

const sortVariants = (variants: AlgorithmVariant[]): AlgorithmVariant[] =>
  [...variants].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    return a.displayOrder - b.displayOrder
  })

export const VariantList = ({ variants }: VariantListProps) => {
  const sorted = sortVariants(variants)
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((v) => (
        <li
          key={v.id}
          className={`rounded-lg border p-4 ${
            v.isPrimary ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <code className="font-mono text-sm">{v.notation}</code>
            <span className="text-xs text-muted-foreground">
              {v.moveCountHtm} HTM · {v.moveCountStm} STM
              {v.isPrimary ? ' · primary' : ''}
            </span>
          </div>
          {v.attribution ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Attribution: {v.attribution}
            </p>
          ) : null}
          {v.fingertrickMd ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium">
                Fingertricks
              </summary>
              <p className="mt-2 text-sm leading-relaxed">{v.fingertrickMd}</p>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5.6: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 5.7: Commit**

```bash
git add apps/web/src/components/algorithm/
git commit -m "$(cat <<'EOF'
feat(web): add catalog presentation components

MethodCard / SetCard / CaseCard for the four catalog levels — each is
a Link-wrapped tile with semantic-token styling. CaseGrid is the
responsive grid for the case index page (2 → 3 → 4 → 5 cols on
sm/md/lg). VariantList sorts primary first, alternates after by
displayOrder, with collapsible fingertrick_md as a native <details>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/3x3` puzzle hub route

**Files:**
- Create: `apps/web/src/app/3x3/page.tsx`

Static route — no params. Lists methods. `revalidate = 600`.

- [ ] **Step 6.1: Create `apps/web/src/app/3x3/page.tsx`**

```tsx
import type { Metadata } from 'next'

import { MethodCard } from '@/components/algorithm/method-card'
import { getMethods } from '@/features/catalog/catalog-fetchers'

export const revalidate = 600

export const metadata: Metadata = {
  title: '3x3 — rubik-algorithm',
  description: 'CFOP and other methods for the 3x3 cube.',
}

const PUZZLE_SLUG = '3x3'

export default async function PuzzlePage() {
  const methods = await getMethods(PUZZLE_SLUG)
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">3x3 — Methods</h1>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {methods.map((m) => (
          <MethodCard key={m.slug} method={m} puzzleSlug={PUZZLE_SLUG} />
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 6.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/app/3x3/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /3x3 puzzle hub route

Server component, ISR via revalidate=600. Reads /v1/puzzles/3x3/methods
and renders MethodCards in a responsive grid. Static route — no
generateStaticParams needed (no param segments).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `/3x3/[method]` route

**Files:**
- Create: `apps/web/src/app/3x3/[method]/page.tsx`

Method overview — lists sets. `generateStaticParams` reads methods at build time.

- [ ] **Step 7.1: Create `apps/web/src/app/3x3/[method]/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SetCard } from '@/components/algorithm/set-card'
import { getMethods, getSets } from '@/features/catalog/catalog-fetchers'
import type { ApiError } from '@/lib/api-client'

export const revalidate = 600

const PUZZLE_SLUG = '3x3'

export const generateStaticParams = async () => {
  const methods = await getMethods(PUZZLE_SLUG)
  return methods.map((m) => ({ method: m.slug }))
}

interface PageProps {
  params: Promise<{ method: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { method } = await params
  return {
    title: `${method.toUpperCase()} — 3x3 — rubik-algorithm`,
    description: `${method.toUpperCase()} method on the 3x3 cube.`,
  }
}

export default async function MethodPage({ params }: PageProps) {
  const { method } = await params
  let sets
  try {
    sets = await getSets(PUZZLE_SLUG, method)
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold capitalize">{method}</h1>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {sets.map((s) => (
          <SetCard
            key={s.slug}
            set={s}
            puzzleSlug={PUZZLE_SLUG}
            methodSlug={method}
          />
        ))}
      </ul>
    </main>
  )
}
```

(`params` is a Promise in Next 15 per §010 React rule.)

- [ ] **Step 7.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 7.3: Commit**

```bash
git add apps/web/src/app/3x3/[method]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /3x3/[method] method overview route

Server component with generateStaticParams reading methods at build,
revalidate=600 for ISR. Reads sets via /v1/puzzles/3x3/methods/:m/sets
and renders SetCards. notFound() on api 404; otherwise rethrows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `/3x3/[method]/[set]` catalog grid route

**Files:**
- Create: `apps/web/src/app/3x3/[method]/[set]/page.tsx`

Set page — case grid. `generateStaticParams` cross-products methods × sets.

- [ ] **Step 8.1: Create `apps/web/src/app/3x3/[method]/[set]/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CaseGrid } from '@/components/algorithm/case-grid'
import {
  getMethods,
  getSets,
  getSetWithCases,
} from '@/features/catalog/catalog-fetchers'
import type { ApiError } from '@/lib/api-client'

export const revalidate = 600

const PUZZLE_SLUG = '3x3'

export const generateStaticParams = async () => {
  const methods = await getMethods(PUZZLE_SLUG)
  const params: { method: string; set: string }[] = []
  for (const m of methods) {
    const sets = await getSets(PUZZLE_SLUG, m.slug)
    for (const s of sets) {
      params.push({ method: m.slug, set: s.slug })
    }
  }
  return params
}

interface PageProps {
  params: Promise<{ method: string; set: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { method, set } = await params
  return {
    title: `${set.toUpperCase()} — ${method.toUpperCase()} — rubik-algorithm`,
    description: `Algorithms for the ${set.toUpperCase()} set in the ${method.toUpperCase()} method.`,
  }
}

export default async function SetPage({ params }: PageProps) {
  const { method, set } = await params
  let setData
  try {
    setData = await getSetWithCases(set)
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">{setData.name}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {setData.cases.length} of {setData.caseCountExpected} cases
      </p>
      <CaseGrid
        cases={setData.cases}
        recognitionBasis={setData.recognitionBasis}
        puzzleSlug={PUZZLE_SLUG}
        methodSlug={method}
        setSlug={set}
      />
    </main>
  )
}
```

- [ ] **Step 8.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/app/3x3/[method]/[set]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /3x3/[method]/[set] catalog grid route

Server component, ISR via revalidate=600. generateStaticParams cross-
products methods × sets at build time. Reads /v1/sets/[set] (which
returns the set with its cases nested) and renders CaseGrid. The
recognition_basis from the set drives which SVG view each CaseCard
thumbnail uses.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/3x3/[method]/[set]/[case]` case page

**Files:**
- Create: `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`

Hero diagram + recognition copy + variant list. `generateStaticParams` cross-products methods × sets × cases.

- [ ] **Step 9.1: Create `apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VariantList } from '@/components/algorithm/variant-list'
import { CubeStateDiagram } from '@/components/cube/cube-state-diagram'
import {
  getCaseWithVariants,
  getMethods,
  getSets,
  getSetWithCases,
} from '@/features/catalog/catalog-fetchers'
import type { ApiError } from '@/lib/api-client'
import { Markdown } from '@/lib/markdown'

export const revalidate = 600

const PUZZLE_SLUG = '3x3'

export const generateStaticParams = async () => {
  const methods = await getMethods(PUZZLE_SLUG)
  const params: { method: string; set: string; case: string }[] = []
  for (const m of methods) {
    const sets = await getSets(PUZZLE_SLUG, m.slug)
    for (const s of sets) {
      const setData = await getSetWithCases(s.slug)
      for (const c of setData.cases) {
        params.push({ method: m.slug, set: s.slug, case: c.slug })
      }
    }
  }
  return params
}

interface PageProps {
  params: Promise<{ method: string; set: string; case: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { case: caseSlug } = await params
  try {
    const c = await getCaseWithVariants(caseSlug)
    return {
      title: `${c.displayName} — rubik-algorithm`,
      description: c.recognitionMd?.slice(0, 160) ?? `${c.displayName} algorithm and recognition.`,
    }
  } catch {
    return { title: 'Case not found — rubik-algorithm' }
  }
}

const HERO_SIZE = 320

export default async function CasePage({ params }: PageProps) {
  const { method, set, case: caseSlug } = await params

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href={`/${PUZZLE_SLUG}`} className="hover:underline">
          3x3
        </Link>
        {' / '}
        <Link href={`/${PUZZLE_SLUG}/${method}`} className="hover:underline capitalize">
          {method}
        </Link>
        {' / '}
        <Link href={`/${PUZZLE_SLUG}/${method}/${set}`} className="hover:underline">
          {setData.name}
        </Link>
        {' / '}
        <span className="font-medium text-foreground">{caseData.displayName}</span>
      </nav>

      <h1 className="mb-8 text-4xl font-bold">{caseData.displayName}</h1>

      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
        <div className="shrink-0">
          <CubeStateDiagram
            caseState={caseData.caseState}
            recognitionBasis={setData.recognitionBasis}
            size={HERO_SIZE}
            title={caseData.displayName}
          />
        </div>
        <div className="flex-1">
          {caseData.recognitionMd ? (
            <section>
              <h2 className="mb-2 text-xl font-semibold">Recognition</h2>
              <Markdown source={caseData.recognitionMd} />
            </section>
          ) : null}
          {caseData.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {caseData.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold">Variants</h2>
        <VariantList variants={caseData.variants} />
      </section>
    </main>
  )
}
```

- [ ] **Step 9.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/src/app/3x3/[method]/[set]/[case]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /3x3/[method]/[set]/[case] case page

The leaf route — hero CubeStateDiagram (320px), breadcrumb nav,
recognition_md rendered via Markdown wrapper, tag chips, and a
VariantList sorted primary-first. generateStaticParams walks the full
methods × sets × cases tree at build time. Case + set are fetched in
parallel via Promise.all to overlap api round-trips.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `/3x3/not-found.tsx`

**Files:**
- Create: `apps/web/src/app/3x3/not-found.tsx`

Friendly 404 for the catalog tree. Used when any catalog route calls `notFound()`.

- [ ] **Step 10.1: Create `apps/web/src/app/3x3/not-found.tsx`**

```tsx
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function CatalogNotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">Not in the catalog</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t find that puzzle, method, set, or case. Pick something from the
        catalog to keep browsing.
      </p>
      <Button asChild>
        <Link href="/3x3">Browse the catalog</Link>
      </Button>
    </main>
  )
}
```

- [ ] **Step 10.2: Typecheck**

Run: `pnpm --filter @rubik/web typecheck`. Expected: clean.

- [ ] **Step 10.3: Commit**

```bash
git add apps/web/src/app/3x3/not-found.tsx
git commit -m "$(cat <<'EOF'
feat(web): add catalog not-found.tsx

Picks up notFound() calls from any catalog route (e.g.,
/3x3/cfop/pll/zzzz). Friendly copy + Catalog button to keep the
user moving. Adjacent to /3x3/page.tsx so it scopes to the catalog
tree per Next.js's segment-resolution.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Build smoke + verify everything compiles

**Files:**
- (None modified)

The build is the most thorough gate. It runs `generateStaticParams` against the live api at build time, so the api MUST be running. This step verifies SSG works end-to-end.

- [ ] **Step 11.1: Confirm api is running with seeded content**

Run:

```bash
curl -s http://localhost:3001/v1/puzzles | jq -c '.[] | {slug}'
curl -s http://localhost:3001/v1/sets/pll | jq -c '{slug, caseCount: .cases | length}'
```

Expected: `{slug: "3x3"}` and `{slug: "pll", caseCount: 3}`.

- [ ] **Step 11.2: Run typecheck + lint + build**

```bash
pnpm --filter @rubik/web typecheck
pnpm --filter @rubik/web lint
pnpm --filter @rubik/web build
```

Expected: all clean. Build report should show ≥14 static pages: `/`, `/login`, `/3x3`, `/3x3/cfop`, `/3x3/cfop/f2l`, `/3x3/cfop/oll`, `/3x3/cfop/pll`, then 3 cases per set × 3 sets = 9 case pages, plus `/api/auth/[...nextauth]` (dynamic) and `/_not-found`.

Confirm that the build log mentions "Generating static pages (X/X)" with X ≥ 14.

If the build fails on `generateStaticParams` because the api isn't reachable, ensure `make dev.api` is running and `NEXT_PUBLIC_API_URL=http://localhost:3001` in `apps/web/.env`.

- [ ] **Step 11.3: Bundle size check**

Inspect the build output for First Load JS values. Per §19.9 the budget is non-visualizer JS <200kb gzipped. Catalog routes should still hit ~110-120kb shared (slight bump from 7a's 102kb due to react-markdown + remark-gfm). If anything spikes past 180kb, investigate.

(No commit — this is verification only.)

---

## Task 12: Manual smoke verification (no commit)

Validates the four catalog routes against real seeded data.

- [ ] **Step 12.1: Boot web in dev mode**

Run (in another terminal): `pnpm --filter @rubik/web dev`. Wait for "Ready in N ms".

- [ ] **Step 12.2: Visit `/`**

Browser: `http://localhost:3000`. Expected: site header (logo + Catalog link + sign-in button), centered hero with "rubik-algorithm" h1 + tagline.

- [ ] **Step 12.3: Visit `/3x3`**

Browser: `http://localhost:3000/3x3`. Expected: "3x3 — Methods" h1 + a single MethodCard "CFOP" linking to `/3x3/cfop`.

- [ ] **Step 12.4: Visit `/3x3/cfop`**

Browser: `http://localhost:3000/3x3/cfop`. Expected: "Cfop" h1 + three SetCards (F2L 41 cases, OLL 57 cases, PLL 21 cases) — note the case_count_expected from the api is the design target, not the currently-seeded count.

- [ ] **Step 12.5: Visit `/3x3/cfop/pll`**

Browser: `http://localhost:3000/3x3/cfop/pll`. Expected: "PLL" h1, "3 of 21 cases" subhead, three CaseCards with thumbnail SVG diagrams (T-Perm, Aa-Perm, Ab-Perm).

- [ ] **Step 12.6: Visit `/3x3/cfop/pll/t-perm`**

Browser: `http://localhost:3000/3x3/cfop/pll/t-perm`. Expected:
- Breadcrumb: 3x3 / Cfop / PLL / T-Perm
- "T-Perm" h1
- Hero PLLView SVG (320px) showing the canonical T-Perm sticker pattern
- Recognition copy rendered with markdown styling
- Tag chips: pll, edge-corner-3-cycle
- Variants section with the primary T-Perm notation: `R U R' U' R' F R2 U' R' U' R U R' F'`
- Move count badge: "14 HTM · 14 STM · primary"

- [ ] **Step 12.7: Visit a 404 path**

Browser: `http://localhost:3000/3x3/cfop/pll/zzzz`. Expected: "Not in the catalog" 404 page with a "Browse the catalog" button.

- [ ] **Step 12.8: Visit other case pages to verify view dispatch**

```
/3x3/cfop/oll/sune   → OLLView (oriented top face, top-down style)
/3x3/cfop/f2l/f2l-1  → F2LView (slot-pair perspective)
```

Each should render a different SVG layout reflecting `recognition_basis`.

- [ ] **Step 12.9: Stop dev**

Ctrl-C the `pnpm --filter @rubik/web dev` process.

If any step fails, do not close the sub-phase — fix and re-test.

---

## Final task: Sub-phase wrap-up

- [ ] **Step F.1: Confirm the commit graph**

Run: `git log --oneline 79a9886..HEAD`

Expected (newest first):
```
<hash> feat(web): add catalog not-found.tsx
<hash> feat(web): add /3x3/[method]/[set]/[case] case page
<hash> feat(web): add /3x3/[method]/[set] catalog grid route
<hash> feat(web): add /3x3/[method] method overview route
<hash> feat(web): add /3x3 puzzle hub route
<hash> feat(web): add catalog presentation components
<hash> feat(web): add SiteHeader and mount in root layout
<hash> feat(web): add CubeStateDiagram dispatcher
<hash> feat(web): add catalog fetchers for the public api endpoints
<hash> feat(web): add markdown wrapper with sanitize + gfm
```

- [ ] **Step F.2: Confirm full quality gates**

Run: `pnpm --filter @rubik/web typecheck && pnpm --filter @rubik/web lint && pnpm --filter @rubik/web build` (api must be running).

Expected: all green.

- [ ] **Step F.3: Done-when checklist**

```
- [x] Four catalog routes ship + 404 page
- [x] <SiteHeader /> mounted in root layout; landing page reflows
- [x] <CubeStateDiagram /> correctly dispatches by recognition_basis
- [x] <Markdown /> wraps react-markdown with remark-gfm + rehype-sanitize
- [x] Catalog fetchers cover all needed endpoints; 'server-only' fenced
- [x] All routes use export const revalidate = 600 and generateStaticParams where applicable
- [x] pnpm --filter @rubik/web typecheck && lint && build clean
- [x] Smoke checklist 12.1-12.8 verified locally with the running api
- [x] Commits follow lowercase Conventional Commits with scope `web`
```

---

## Out of scope (do not implement)

- /search + ⌘K palette — 7c
- /me/algorithms and any auth-gated routes — 7c
- Refresh-on-401 logic — 7c
- /timer — 7d
- /embed/visualizer — 7d
- SEO (sitemap, robots, JSON-LD HowTo, opengraph-image) — 7d
- Per-case dynamic OG image — 7d
- Sentry — 7d
- Storybook — 7d
- Playwright e2e — 7d
- Lighthouse budget tuning — 7d
- 3D Visualizer — gated on plan 04b
- Mobile-optimized nav (hamburger) — 7d
- shadcn Accordion / Card / Badge — install per-component as needed; for 7b we use Tailwind primitives directly
- Search/filter/sort within the catalog grid — defer until corpus grows past ~50 cases
- Recognition images — content backlog
