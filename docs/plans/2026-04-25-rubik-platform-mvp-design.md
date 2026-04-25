# Rubik Platform — MVP Design

**Date:** 2026-04-25
**Status:** Draft (v1, awaiting review)
**Owner:** tanphat199@gmail.com

## 1. Goals and non-goals

### Goals
- Ship a real, public product for the speedcubing community.
- Anchor v1 on **learning** for the **3x3 / Full CFOP** curriculum: F2L (41), OLL (57), PLL (21).
- Best-in-class algorithm pages — searchable, SEO-friendly, with embedded 3D visualizer.
- Logged-in users can mark algorithms as `learning` / `learned` / `mastered` and maintain a personal sheet.
- Architect for **multi-puzzle / multi-method extension** without a rewrite (Megaminx, Pyraminx, Roux, ZZ in v2+).

### Non-goals (v1)
- Other puzzles (2x2, 4x4, 5x5, Square-1, Megaminx, Pyraminx, Skewb).
- Other methods (Roux, ZZ, beginner LBL).
- Advanced sets (COLL, ZBLL, WV, VLS).
- Solver (state input → solution). Deferred to v2.
- Rich trainer drills (PLL/OLL recognition tests). Basic timer only in v1.
- Camera input, mobile native apps, public profiles, leaderboards, social features.

## 2. MVP scope (what ships)

| Capability | In v1 | Notes |
|---|---|---|
| Browse: puzzles → methods → sets → algorithms | ✅ | SSR for SEO. Only 3x3/CFOP populated, but data model holds all. |
| Algorithm detail page | ✅ | Notation, multiple variants, recognition tips, 3D visualizer, stickered face diagrams. |
| 3D cube visualizer | ✅ | Embedded on every alg page; play/scrub/loop a sequence. |
| Search across algorithms | ✅ | Name, set, notation substring, case keywords ("T perm"). |
| Scramble generator (3x3 WCA) | ✅ | Used by timer + scramble-this-case feature. |
| Minimal timer | ✅ | Inspection, solve time, last-N average. No session history persistence in v1; localStorage only. |
| Auth: Google OAuth | ✅ | Required for personal sheet, alg progress. |
| Personal algorithm sheet | ✅ | Per-user list of algs with status + chosen variant + personal notes. |
| Trainer drills | ❌ | v2. |
| Solver | ❌ | v2. |
| Other puzzles/methods | ❌ | v2+. |

## 3. Architecture overview

Monorepo (pnpm workspaces):

```
rubik-algorithm/
├── apps/
│   ├── web/          Next.js 15 (App Router) — frontend + SSR
│   └── api/          Fastify + TypeScript — REST API
├── packages/
│   ├── shared/       Domain types, notation parser, scrambler, validation schemas (zod)
│   ├── cube-core/    Pure 3x3 cube model: state, move application, sticker layout
│   └── visualizer/   React + three.js cube renderer (consumed by web)
├── content/          Authored algorithm data as YAML/JSON (versioned in git)
└── docs/
```

### Tech stack
- **Language:** TypeScript end-to-end.
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind v4, Radix primitives.
- **3D:** three.js + @react-three/fiber + @react-three/drei.
- **Backend:** Fastify 5, Prisma 6, zod for validation, OpenAPI spec generated.
- **Database:** PostgreSQL 17 (Neon serverless).
- **Cache:** Redis (Upstash) — session, hot reads, scramble counters.
- **Auth:** Google OAuth → JWT (httpOnly cookie). NextAuth on the web app for the OAuth flow; API verifies signed JWTs.
- **Search:** Postgres full-text + trigram in v1. Move to Meilisearch when content scales beyond 3x3/CFOP.
- **Testing:** Vitest (unit), Playwright (e2e), Storybook (visual review of cube/alg components).
- **Deployment:** Vercel (web), Fly.io (api), Neon (Postgres), Upstash (Redis), Cloudflare R2 (media).
- **Observability:** OpenTelemetry → Grafana Cloud; Sentry for FE/BE errors.

### Why split frontend and backend?
The user asked for a clear fullstack split. Concretely it buys us:
- A clean public REST API future mobile / embeddable widgets / third-party tools can consume.
- Independent scaling: API can serve high-RPS scramble/algorithm reads behind a CDN; web app scales with SSR traffic.
- Forces stable contracts (OpenAPI), which pays off the moment we add a second client.

## 4. Domain model

The model is **puzzle-agnostic at the top, puzzle-specific at the leaves**. v1 only populates the 3x3 row, but every table accommodates other puzzles without schema change.

```
Puzzle (3x3, 4x4, megaminx, …)
 └─ Method (CFOP, Roux, beginner-LBL, …)
     └─ AlgorithmSet (F2L, OLL, PLL, …)
         └─ AlgorithmCase (e.g., "PLL: T-perm", "OLL 21")
             └─ AlgorithmVariant (different finger-trick versions of the same case)
```

### Entities

**Puzzle**
- `id` (slug, e.g., `3x3`)
- `name`, `display_order`, `wca_event_code` (nullable)
- `state_schema_version` — points to the sticker layout / move set definition

**Method** — `id`, `puzzle_id`, `slug` (`cfop`), `name`, `description_md`, `display_order`

**AlgorithmSet** — `id`, `method_id`, `slug` (`pll`), `name`, `case_count_expected` (e.g., 21), `recognition_basis` (`last_layer`, `f2l_pair`, `oll_orientation`, etc.)

**AlgorithmCase**
- `id`, `set_id`, `slug` (`t-perm`), `name`, `display_name`, `display_order`
- `case_state` — JSON describing the cube state that defines this case (which stickers in which positions). Used by visualizer to render the recognition image.
- `recognition_md` — markdown notes on how to spot the case
- `tags` (string[]) — e.g., `["adjacent-corner-swap", "edge-3-cycle"]`

**AlgorithmVariant**
- `id`, `case_id`, `notation` (string, WCA notation), `move_count_htm`, `move_count_stm`
- `is_primary` (boolean), `attribution` (author/source string)
- `fingertrick_md` (optional walkthrough)

**User** — `id`, `email`, `display_name`, `google_sub`, `created_at`

**UserAlgorithm**
- `user_id`, `case_id`, `chosen_variant_id` (nullable)
- `status` enum: `learning | learned | mastered`
- `personal_notes_md`
- `updated_at`

### Why model `Case` and `Variant` separately?
T-perm (the case) is one recognition target. Different speedcubers learn different finger-trick sequences for it. Separating case from variant lets users pick their preferred variant while the case stays the unit of progress.

### Cube state representation (`packages/cube-core`)
- 3x3 represented as **54-sticker array** (faces UFRDLB, row-major) for rendering and recognition.
- Internally also a **piece-orientation model** (8 corners with orientation 0–2, 12 edges with orientation 0–1) for move application — fast, allocation-free, easy to test.
- Move parser handles WCA notation: `U U' U2 R F L B D R' M E S Rw Lw Uw x y z` etc.
- Public API: `applyMoves(state, "R U R' U'") → state`, `parseAlgorithm(str) → Move[]`, `expandWideAndRotations`, `inverse`, `mirror(axis)`.
- Designed pure / immutable; abstract enough that a 4x4 / megaminx core can implement the same interface in v2.

## 5. API surface

REST. Versioned at `/v1`. JSON. OpenAPI spec generated from zod schemas.

### Public (no auth)
- `GET /v1/puzzles` — list puzzles
- `GET /v1/puzzles/:puzzle/methods` — list methods for a puzzle
- `GET /v1/puzzles/:puzzle/methods/:method/sets` — list algorithm sets
- `GET /v1/sets/:set` — set detail with all cases (denormalized for fast page loads)
- `GET /v1/cases/:case` — case detail with all variants
- `GET /v1/search?q=…` — search algorithms
- `GET /v1/scramble?puzzle=3x3` — generate WCA-style scramble
- `GET /v1/scramble/case/:case` — generate scramble that lands on a specific case (e.g., "scramble me into a T-perm")

All public endpoints are idempotent GETs with `Cache-Control: public, s-maxage=…` so they sit behind Cloudflare for free.

### Authed (`Authorization: Bearer <jwt>`, set by web app from httpOnly cookie)
- `GET /v1/me` — current user
- `GET /v1/me/algorithms` — personal sheet
- `PUT /v1/me/algorithms/:case` — `{ status, chosen_variant_id, personal_notes_md }`
- `DELETE /v1/me/algorithms/:case`

### Auth
- `POST /v1/auth/google` — exchange Google ID token for app JWT (web does the OAuth dance, hands the ID token to the API)
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

## 6. Frontend structure

Routes (App Router):

```
/                              Landing page
/3x3                           Puzzle hub
/3x3/cfop                      Method overview + curriculum order
/3x3/cfop/pll                  Set page — grid of all 21 PLLs with state previews
/3x3/cfop/pll/t-perm           Case page — variants, visualizer, recognition, notes
/timer                         Minimal timer + scrambler
/me/algorithms                 Personal algorithm sheet (auth)
/search?q=…                    Search results
/login                         Google sign-in
```

### SSR/SSG strategy
- All public content pages: SSG with on-demand revalidation when content changes (revalidate webhook from CMS / git push).
- Sitemap auto-generated from the Puzzle/Method/Set/Case tree.
- Each case page emits structured data (`schema.org/HowTo` for the algorithm steps) for rich Google results.
- The `/me/...` routes are CSR with auth-guarded server components.

### Key shared components
- `<CubeVisualizer state | algorithm | initialState+algorithm />` — animated 3D cube. Props: speed, autoplay, loop, controls (play/pause/scrub/step). Used on case page, set grid (low-detail SVG fallback), search results.
- `<StateDiagram puzzle state view="top" | "f2l-slot" | "oll" | "pll" />` — flat 2D sticker diagram, SVG. Cheap, used in grids.
- `<AlgorithmNotation moves="R U R' U'" />` — interactive move list with click-to-scrub on a connected visualizer.
- `<RecognitionCard />` on case page.

## 7. Visualizer

Implementation in `packages/visualizer`, consumed by web app.

- **Renderer:** three.js with @react-three/fiber. One `Group` per cubie. Move animation rotates a transient `Group` containing the 9 cubies of the rotating face, then re-parents them after the rotation completes and snaps to a clean state. This is the standard, glitch-free approach.
- **Inputs:** initial state (54-sticker string) + algorithm string. Optionally a single state for static views.
- **Controls:** play, pause, step forward/back, scrub, speed (0.25x–4x), loop, reset, swap-perspective (orbit camera).
- **Performance budget:** 60fps on a 2020 mid-tier laptop; lazy-loaded chunk so it doesn't bloat the set-grid page (SVG fallback there).
- **Accessibility:** all controls keyboard-reachable; announce move steps to screen readers; reduced-motion mode disables animation and shows static end-state.
- **Embeddable:** the visualizer ships a standalone iframe route `/embed/visualizer?state=…&alg=…` with no chrome, sized via postMessage. Sets us up for "embed on r/cubers" without extra work.

## 8. Auth and user features

- **Provider:** Google OAuth only in v1 (matches both reference sites; lowest friction for the audience).
- **Flow:** NextAuth on web → Google ID token → POST to API `/v1/auth/google` → API verifies token signature/audience, upserts `User`, returns app JWT (15-min access + 30-day refresh).
- **Storage:** access JWT in `httpOnly`, `Secure`, `SameSite=Lax` cookie scoped to api domain; refresh token rotated on use.
- **Personal sheet:** users mark cases as `learning|learned|mastered` and pick a preferred variant. Shown as a filterable grid with progress totals ("31/57 OLLs learned").
- **Privacy:** no public profile in v1. Only the user sees their own data. Email never displayed.

## 9. Content authoring and data

Content lives in `content/` as YAML, versioned in git. A migration script ingests YAML → Postgres on deploy.

```yaml
# content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml
slug: t-perm
name: T Perm
display_order: 14
recognition_md: |
  Bar on left side, two adjacent headlights with non-matching corners…
case_state: "UUUUUUUUU R B R F R F R F R B B B L L L L L L D D D D D D D D D F F F F F F F F F"
tags: [adjacent-corner-swap, edge-2-cycle]
variants:
  - notation: "R U R' U' R' F R2 U' R' U' R U R' F'"
    is_primary: true
    attribution: "Standard"
    fingertrick_md: "..."
  - notation: "x R2 D2 R' U' R D2 R' U R'"
    is_primary: false
    attribution: "Alternate"
```

This keeps the editorial workflow (you, contributors) on git/PRs, with diffs and review, instead of a CMS UI you'd have to build first. We can layer an admin UI on top in v2 if contributors arrive.

### Initial content commitments for v1 launch
- 41 F2L cases, each with primary variant + at least one alternate.
- 57 OLL cases, primary variant.
- 21 PLL cases, primary variant + 1–2 popular alternates each.
- Method overview pages with curriculum order.
- "What is CFOP / F2L / OLL / PLL" intro pages (markdown).

## 10. SEO

This is a content-heavy product; SEO is the growth engine.

- SSG every public page; clean `/3x3/cfop/pll/t-perm`-style URLs.
- Sitemap, robots, canonicals.
- `schema.org/HowTo` per case (steps = moves).
- OG images: server-rendered cube state thumbnails per case.
- Page targets: `<60kb HTML`, `<200kb JS for non-visualizer pages`, LCP <2.5s on 4G.

## 11. Testing strategy

- `cube-core` is the heart and gets exhaustive unit tests: known scrambles, alg inverses, identity sequences, OLL/PLL case detection round-trips. Property-based tests via fast-check (any sequence + its inverse = identity).
- API: Fastify + Vitest integration tests against a Postgres test container.
- Web: component tests (Vitest + Testing Library), Playwright e2e for the critical flows (browse → case page → mark learned → see in /me).
- Visualizer: Storybook with visual regression snapshots (Chromatic or local Playwright).
- CI: lint, typecheck, unit, integration, e2e on every PR; preview deploy per PR.

## 12. Deployment and environments

- Environments: `dev` (local Docker Compose), `preview` (per-PR Vercel + Fly preview machines), `prod`.
- Web: Vercel.
- API: Fly.io with 2 small machines behind a load balancer; horizontal autoscale on CPU.
- DB: Neon (branching per preview env is a huge dev-loop win).
- CDN: Cloudflare in front of api.* for cacheable GETs.
- Secrets: Doppler or Vercel/Fly env vars; nothing in repo.
- Migrations: Prisma migrate, run in a one-shot Fly machine on deploy, gated by approval for prod.

## 13. Roadmap beyond v1

In rough priority order:

1. **Trainer mode** — PLL recognition drill (timed flashcard), OLL recognition, F2L case drill. Reuses visualizer + state generator.
2. **Solver** — Kociemba two-phase for 3x3, served from a dedicated worker. Step-by-step playback in visualizer.
3. **Other 3x3 methods** — Roux, ZZ, beginner LBL. Pure content addition; data model already supports it.
4. **Other puzzles** — start with 2x2 (subset of 3x3), then 4x4, then non-cubic (Pyraminx, Skewb, Megaminx, Square-1). Each non-cubic puzzle needs its own `cube-core`-equivalent and visualizer adapter.
5. **Advanced sets** — COLL, ZBLL, WV, VLS once core CFOP audience is engaged.
6. **Camera input** — webcam → cube state; ships solver to a wider audience.
7. **Public profiles + social** — share your sheet, follow cubers, alg of the day.
8. **Native mobile** — React Native shell over the same API; offline alg sheet.

## 14. Open questions to resolve before code

1. **Domain name** — pick before launch; influences brand assets.
2. **Initial content sourcing** — author from scratch vs. license existing data (with attribution) vs. invite contributors. Affects time-to-launch a lot.
3. **Monetization stance** — totally free, donations, Pro tier later? Influences whether we add billing scaffolding now.
4. **Analytics** — Plausible (privacy-friendly) vs. PostHog (product analytics); pick one before launch to avoid retrofitting events.
5. **Non-Google sign-in** — confirm "Google only" is acceptable for the cubing audience. (Check: SpeedCubeDB and CubeRoot both ship Google-only; this is fine.)

## 15. Risks

- **Content volume** — 119 cases × variants × notes is a lot of authoring. Mitigation: start with primary variants only; add alternates post-launch.
- **Visualizer perf on low-end devices** — three.js + many cubies can hit fill-rate limits on phones. Mitigation: SVG fallback on grids, single visualizer per page, lazy load.
- **SEO ramp time** — organic traffic takes months. Mitigation: launch with a complete CFOP corpus so Google has reason to crawl deeply.
- **Scope creep into trainer/solver** — every cuber will ask for these. Mitigation: roadmap them publicly; defend v1 scope.
