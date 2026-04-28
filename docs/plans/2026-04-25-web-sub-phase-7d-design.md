# Web sub-phase 7d — Timer + SEO finishing

> Plan 07 sub-phase 7d. The discovery + tracking surface (7c) shipped to `main`. This sub-phase adds the minimal-WCA timer (general + per-case), wires the case-page "Time this case" CTA, and ships the SEO bag (sitemap, robots, JSON-LD, dynamic OG image). The `/embed/visualizer` route is deferred to a later sub-phase because plan 04b (the 3D client) has not shipped — without it, an embed would render only a static SVG and miss the "interactive playback" promise.

## 1. Goal

Ship the timer surface so a user can:

- Visit `/timer` and time random WCA scrambles with the keyboard.
- Visit `/timer?case=t-perm` (or click "Time this case" on a case page) to drill scrambles that land in a specific case.
- See `best`, `worst`, `ao5`, `ao12` derived from a rolling localStorage history (capped at 100 entries).
- Edit per-time penalties (`OK` / `+2` / `DNF`) inline.

And ship the SEO bag so the catalog is discoverable:

- `app/sitemap.ts` enumerates every case URL (no api change).
- `app/robots.ts` allows everything except `/me/*` and the future `/embed/*`.
- Case page emits JSON-LD `schema.org/HowTo` (steps = primary-variant moves).
- Per-case dynamic `opengraph-image.tsx` renders the case state via the SVG views.

## 2. Out of scope

| Item | Why deferred |
|---|---|
| `/embed/visualizer` | Needs plan 04b (3D client). Static-SVG embed misses the use case. Future 7e. |
| Server-side sync of solve history | localStorage-only per design line 33; v2 concern. |
| Touch-screen tap-to-start UX | Spacebar-first per cubing convention; touch UX is 7e. |
| Stackmat / Bluetooth timer integration | Hardware integration is v2. |
| Variant-specific drilling (drill T-Perm "y2 R" variant) | Variant picker not built (deferred from 7c); per-case = primary variant. |
| Sentry, Storybook, Playwright e2e | Quality bag (group D) — separate sub-phase. |
| `chosenVariantId` picker, `personalNotesMd` editor | Tracking-deepening (group C) — separate sub-phase. |
| Mobile-optimized command palette, route groups `(app)/(marketing)/(auth)` | UX polish — separate sub-phase. |

## 3. User-visible surfaces

### 3.1 `/timer` (general WCA)

Single client component. Layout: scramble notation at the top, a large timer display in the middle, the times list below.

**Initial state:** fetch `GET /v1/scramble?puzzle=3x3` (TanStack Query, `staleTime: 0` — every visit gets a fresh scramble), display the notation. Timer reads `0.00`.

**Keyboard interaction (state machine — see §4.2):**

1. **Idle** — `Space` ↓ enters Inspecting (15s countdown starts).
2. **Inspecting** — `Space` ↓ enters Ready (waits for release). Visual cue at 8s (yellow), 12s (red). Auto-`+2` between 15-17s, auto-`DNF` past 17s — applied on attempt completion, not in inspection.
3. **Ready** — `Space` ↑ enters Solving (timer starts, scramble notation hidden so the cuber doesn't peek).
4. **Solving** — any `Space` ↓ enters Done (timer stops, time recorded, applied penalty surfaced, new scramble fetched).
5. **Done** — `Space` ↓ returns to Idle (with the new scramble already loaded).

Skipping inspection: pressing `Space` ↓ from Idle and immediately releasing transitions Idle → Inspecting → Ready → Solving in one tap. Acceptable cuber convention.

**Times list:** chronological-newest-first table. Each row: time formatted `M:SS.cs`, penalty pill, `+2` / `DNF` / `OK` toggle button, delete button. Stats panel (best, worst, ao5, ao12, count) above the list.

### 3.2 `/timer?case=<caseSlug>`

Same component, but `searchParams.case` switches scramble fetching to `GET /v1/scramble/case/:caseSlug`. The header shows `Drilling: T-Perm` instead of "Random". Otherwise identical UX.

If `caseSlug` doesn't resolve (404 from the api), fall back to general mode and surface a `sonner` toast: "Unknown case `xxx` — using random scrambles."

### 3.3 Case-page CTA

Add a "Time this case" link next to the existing `<TrackCaseButton />`. Server-rendered, no client JS:

```tsx
<Link href={`/timer?case=${caseData.slug}` as Route} className="...">
  Time this case →
</Link>
```

### 3.4 SEO surfaces

**`app/sitemap.ts`** — async function enumerating URLs. Reuses `getAllCases()` from 7c (already walks the full catalog tree). Output: `/`, `/3x3`, `/3x3/{method}`, `/3x3/{method}/{set}`, `/3x3/{method}/{set}/{case}` for every leaf. No api change.

**`app/robots.ts`** — declarative `MetadataRoute.Robots`. `allow: '/'`, `disallow: ['/me/', '/embed/', '/api/']`.

**JSON-LD `HowTo`** — `lib/jsonld.ts` exports `caseHowToJsonLd(caseData)` returning a JSON object. Case page injects it as `<script type="application/ld+json">{JSON.stringify(...)}</script>` inside the page body. Steps are the primary variant's moves, one step per move with `name: "R'", text: "Rotate right face counter-clockwise."` (a small notation→prose helper in `lib/notation-prose.ts` keeps it greppable).

**`opengraph-image.tsx`** — co-located with `app/3x3/[method]/[set]/[case]/`. Uses `next/og`'s `<ImageResponse>` to render the case's display name + the SVG diagram (`@rubik/visualizer/ssr` `PLLView`/`OLLView`/`F2LView`/`TopView` based on `recognitionBasis`) on a 1200×630 canvas. Cached per `caseSlug`.

## 4. Architecture

### 4.1 Files

```
apps/web/src/
├── app/
│   ├── timer/
│   │   ├── page.tsx                          'use client' shell + Suspense boundary
│   │   └── opengraph-image.tsx               static "Timer" OG card (single image)
│   ├── 3x3/[method]/[set]/[case]/
│   │   ├── page.tsx                          (modify: add CTA + JSON-LD script)
│   │   └── opengraph-image.tsx               dynamic per-case OG (new)
│   ├── sitemap.ts                            (new)
│   └── robots.ts                             (new)
│
├── components/timer/
│   ├── timer-display.tsx                     formatted time, color-coded by state
│   ├── scramble-display.tsx                  notation (hidden during Solving)
│   ├── times-list.tsx                        rows + penalty toggles
│   └── stats-panel.tsx                       best / worst / ao5 / ao12 / count
│
├── features/timer/
│   ├── store.ts                              zustand: state machine + times[]
│   ├── persistence.ts                        zustand persist middleware config
│   ├── stats.ts                              pure: ao5, ao12, best, worst
│   ├── format.ts                             pure: ms → "M:SS.cs"
│   └── use-scramble.ts                       TanStack Query for /v1/scramble[/case/:slug]
│
├── lib/
│   ├── jsonld.ts                             caseHowToJsonLd(case)
│   └── notation-prose.ts                     "R'" → "Rotate right face counter-clockwise"
│
└── (no api changes)
```

### 4.2 Timer state machine

Pure zustand store, no XState (overkill for 5 states). Discriminated union per `090-code-style-rule.md`:

```ts
type TimerPhase =
  | { kind: 'idle' }
  | { kind: 'inspecting'; startedAt: number }
  | { kind: 'ready'; inspectionMs: number }
  | { kind: 'solving'; startedAt: number; inspectionMs: number }
  | { kind: 'done'; ms: number; inspectionMs: number; appliedPenalty: Penalty }

type Penalty = 'OK' | 'PLUS_TWO' | 'DNF'
```

Actions: `pressDown()`, `pressUp()`, `tick()` (called by RAF loop only when `kind === 'inspecting' | 'solving'`), `editPenalty(id, penalty)`, `deleteTime(id)`.

Inspection auto-penalty on `pressDown` from `inspecting`:

- `inspectionMs ≤ 15_000` → `OK`
- `15_000 < inspectionMs ≤ 17_000` → `PLUS_TWO`
- `inspectionMs > 17_000` → `DNF`

Recorded time = `ms + (penalty === 'PLUS_TWO' ? 2_000 : 0)`. `DNF` is sorted last in stats.

### 4.3 Data flow

- **Scramble:** `useScramble(mode)` (TanStack Query). `mode` is `{ kind: 'random' } | { kind: 'case', slug: string }`. Key factory: `scrambleKeys.random()`, `scrambleKeys.forCase(slug)`. `staleTime: 0` (every refetch is a fresh scramble) — but the *next* scramble is fetched eagerly via `queryClient.prefetchQuery` in the `Done → Idle` transition so the user doesn't wait.
- **Solve history:** zustand `persist` middleware (key `rubik:timer:v1`). Only the `times[]` array is persisted, never the live `phase` state. Cap at last 100 entries — slice on push.
- **Per-tab autonomy:** the persist middleware `partialize` excludes phase; two tabs running in parallel each have their own machine but share history.

### 4.4 Stats math

Pure functions, fully tested:

- `best(times)` — min `recordedMs` across non-DNF times.
- `worst(times)` — max `recordedMs` across non-DNF times.
- `ao5(times)` — last 5 times: drop best + worst, mean the middle 3. If ≥2 are `DNF`, result is `DNF`. WCA standard.
- `ao12(times)` — last 12: drop best + worst, mean the middle 10. Same DNF rule.
- All return `{ ms: number | null; isDNF: boolean }`.

## 5. Technical decisions / risks

| Decision | Rationale |
|---|---|
| Scramble from api, not client `cube-core` | Keeps `/timer` route bundle small (no `cube-core` in client). API endpoint already exists and is `@Public`. Same source for general + per-case. |
| Zustand over XState | Five states, three transitions per state. Discriminated union + `set` calls suffice. XState is overkill at this complexity. |
| RAF (`requestAnimationFrame`) tick over `setInterval` | Smooth display at 60fps without throttling on tab blur (well, `requestAnimationFrame` *is* throttled on blur — that's actually the desired behavior; the timer pauses display updates but not the wall-clock measurement). |
| Wall-clock measurement via `performance.now()` | Monotonic; immune to NTP corrections. Display ticks via RAF; recorded time is always `performance.now() - startedAt` at solve completion. |
| `staleTime: 0` for scramble + prefetch on Done | Each attempt deserves a fresh scramble; prefetch hides the network round-trip. |
| localStorage cap at 100 entries | Bounded growth (~10 KB worst case at typical entry size). Cubers want session history, not lifetime — 100 covers a long practice session. |
| No SSR for `/timer` page | The whole page is interactive; rendering an empty shell on the server adds nothing. `'use client'` at the page level. |
| OG image cached per `caseSlug` | `next/og`'s default behavior. Plays well with `revalidate = 600` on case pages. |
| JSON-LD inline in case page | Simpler than an external `.jsonld` route. Search engines parse `application/ld+json` script tags. |
| Sitemap walks client catalog fetchers, not a new api endpoint | `getAllCases()` exists; an extra `/v1/sitemap` endpoint would duplicate logic. Build-time cost is one tree walk. |

**Risks:**

- **Browser focus loss during Solving:** if the user alt-tabs mid-solve, RAF stops ticking but `performance.now()` keeps advancing. Display will jump on refocus; recorded time stays correct. Acceptable.
- **Spacebar hold semantics:** `keydown` fires repeatedly while held (autorepeat). Filter via `event.repeat` to take only the first.
- **Inspection RAF leak:** `useEffect` cleanup must cancel the RAF on phase transitions and unmount.
- **localStorage quota:** 100 entries × ~100 bytes each = ~10KB; well under browser limits.
- **Sitemap freshness:** sitemap is computed at build time; new content (added via PR + redeploy) flows through automatically. On-demand revalidation of the catalog (already in 7b) does NOT refresh the sitemap mid-deploy. Acceptable since catalog changes ship via deploy anyway.
- **JSON-LD validation:** Google's Rich Results Test should pass on at least one case page — manual smoke step in the implementation plan.

## 6. Done when

- [ ] `/timer` works keyboard-only: spacebar drives the full Idle → Inspecting → Ready → Solving → Done cycle.
- [ ] Inspection countdown shows 15s with 8s/12s color cues; auto-penalty applied per WCA rules.
- [ ] Times list renders with editable `OK`/`+2`/`DNF` toggles and delete buttons.
- [ ] Stats panel shows `best`, `worst`, `ao5`, `ao12`, `count`; `DNF` math matches WCA.
- [ ] `/timer?case=t-perm` fetches `/v1/scramble/case/t-perm`; unknown case falls back to random with a toast.
- [ ] Case page renders "Time this case →" link to `/timer?case={slug}`.
- [ ] localStorage persists times across reloads; survives a hard refresh during Solving without corruption.
- [ ] `app/sitemap.ts` returns every catalog URL (verified at build).
- [ ] `app/robots.ts` disallows `/me/`, `/embed/`, `/api/`.
- [ ] Case page emits valid JSON-LD `HowTo` (Google Rich Results Test passes for one case).
- [ ] `opengraph-image.tsx` renders a 1200×630 PNG with case name + SVG diagram (visit `/3x3/cfop/pll/t-perm/opengraph-image` to verify).
- [ ] `pnpm --filter @rubik/web typecheck && lint && build` clean.
- [ ] Manual smoke: time five solves on `/timer?case=t-perm`, observe ao5 update on the fifth, edit one to `+2`, observe ao5 recompute.

## 7. Implementation phasing

The sub-phase plan (separate file, `2026-04-25-web-sub-phase-7d-plan.md`, written next) will sequence work as:

1. Timer feature (store, hooks, components, page) — ships independently, no dep on SEO work.
2. Case-page CTA — depends on (1).
3. SEO bag (sitemap, robots, JSON-LD, OG) — independent of (1)/(2).

Each is a clean commit boundary; either can land first.
