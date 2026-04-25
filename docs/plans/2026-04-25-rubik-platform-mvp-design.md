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
│   ├── api/          NestJS 11 + Prisma — REST API
│   └── docs/         VitePress — project documentation site (§17)
├── packages/
│   ├── shared/       Domain types, notation parser, scrambler, validation schemas (zod)
│   ├── cube-core/    Pure 3x3 cube model: state, move application, sticker layout
│   └── visualizer/   React + three.js cube renderer (consumed by web)
├── content/          Authored algorithm data as YAML/JSON (versioned in git)
└── docs/             Internal planning artifacts (this design doc, future plans)
```

The repo houses **three deployable apps** and three shared packages. Web and api run as long-lived services; docs is built to static HTML and served from a CDN. Web is React/Next.js, docs is Vue/VitePress — they share nothing at runtime; pnpm workspaces keep their dep trees independent so neither bloats the other.

### Tech stack
- **Language:** TypeScript end-to-end.
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind v4, Radix primitives.
- **3D:** three.js + @react-three/fiber + @react-three/drei.
- **Backend:** NestJS 11, Prisma 6, zod (or `class-validator`) for DTO validation, OpenAPI spec via `@nestjs/swagger`.
- **Database:** PostgreSQL 17 (Neon serverless).
- **Cache:** Redis (Upstash) — session, hot reads, scramble counters.
- **Auth:** Google OAuth → JWT (httpOnly cookie). NextAuth on the web app for the OAuth flow; API verifies signed JWTs (`@nestjs/jwt` + a `JwtAuthGuard`).
- **Search:** Postgres full-text + trigram in v1. Move to Meilisearch when content scales beyond 3x3/CFOP.
- **Testing:** Vitest (unit), Playwright (e2e), Storybook (visual review of cube/alg components).
- **Deployment:** Vercel (web), Fly.io (api), Neon (Postgres), Upstash (Redis), Cloudflare R2 (media).
- **Observability:** OpenTelemetry → Grafana Cloud; Sentry for FE/BE errors.

### Why NestJS (over Fastify, Hono, FastAPI, Django)
Decision driven by **stability + maintainability** as primary criteria; throughput is not.
- **Fastify** — performant but unopinionated; you carry the conventions burden, no perf benefit for our load.
- **Hono** — optimized for edge/serverless runtimes we don't use; ecosystem still young.
- **FastAPI / Django** — both strong on stability; rejected to keep TypeScript end-to-end so `packages/shared` types flow into both web and api.
- **NestJS** — opinionated module/controller/service/DI structure, official OpenAPI/JWT/queue modules, the longest-trodden NestJS-on-Node path with Prisma. Best long-term maintainability in the TS ecosystem.

### Why Prisma (over Drizzle, TypeORM)
- **Drizzle** — SQL-transparent and edge-friendly, but younger ecosystem and weaker NestJS guides; its strengths (raw perf, JSONB/CTE depth) don't align with our standard relational CRUD.
- **TypeORM** — historical NestJS default; stability has lagged (0.3 migration was rough). Community has moved on.
- **Prisma** — `nestjs-prisma` is the canonical pairing, schema DSL is readable for collaborators, `prisma migrate` is the most polished migration story, and Prisma Studio gives a free DB GUI for content inspection.

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

NestJS structure: one Nest module per top-level resource (`PuzzlesModule`, `MethodsModule`, `SetsModule`, `CasesModule`, `ScrambleModule`, `SearchModule`, `AuthModule`, `MeModule`). DTOs live in `apps/api/src/<module>/dto/`; types that need to flow to the frontend live in `packages/shared`. OpenAPI spec is generated by `@nestjs/swagger` from controller decorators and exposed at `/v1/docs` in non-prod.

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

## 11. Testing as architecture

Testing is treated as a first-class architectural layer with explicit boundaries, ownership, fixtures, and merge gates — not just a strategy footnote.

### Test pyramid by package/app

| Layer | Where it lives | What it tests | Tooling |
|---|---|---|---|
| Unit | `packages/cube-core/__tests__/` | State, move application, alg parsing, recognition. Property-based: any sequence + its inverse = identity; mirror+mirror = identity; conjugate algebra. | Vitest + fast-check |
| Unit | `packages/shared/__tests__/` | DTO/zod schemas, notation tokenizer, scrambler determinism (seeded). | Vitest |
| Component | `packages/visualizer/` (Storybook) | Visualizer renders correctly for canonical states; key algs animate without flicker; reduced-motion fallback. | Storybook + Playwright visual snapshots |
| Integration | `apps/api/test/` | Each Nest module against a real Postgres test container. Auth flow, RBAC, cache invalidation, Prisma queries. | Vitest + Testcontainers |
| Contract | `apps/api/test/contract/` | OpenAPI spec stays in sync with controllers; published schemas don't break clients. | `@nestjs/swagger` snapshot diff |
| Component | `apps/web/__tests__/` | Server components, page renders, alg-page generation from fixture content. | Vitest + Testing Library |
| E2E | `apps/web/e2e/` | Critical flows: browse → case → sign in → mark learned → see in `/me`; visualizer playback; search; embed iframe. | Playwright |

### Test data strategy

- A canonical fixture set lives at `packages/cube-core/fixtures/` and `content/fixtures/`: minimal but realistic (1 puzzle, 1 method, 2 sets, 4 cases, primary variants only). All API integration and web component tests read from this fixture set, not real content. Tests stay fast and deterministic.
- Postgres test DB seeded from fixtures via Prisma at suite startup. Each test runs in a transaction that rolls back, so suites don't interfere.
- `cube-core` carries a "known scrambles" corpus checked in (10–20 well-known scrambles + their solved states + canonical solutions) for regression confidence on parser, mover, and recognizer.

### Coverage and gates

- **`cube-core` has a coverage floor of ≥95% lines.** Correctness here cascades into recognition, scramble-to-case generation, future solver — bugs are expensive.
- Other packages: ≥80% lines as soft target, not a hard gate.
- **PR merge gates** (must pass): typecheck, lint, unit tests, API integration tests.
- **Main-branch gates** (run on `main` and on PRs labeled `e2e`): Playwright E2E + Storybook visual regression. Cost-controlled — not every PR pays the E2E cost.
- Performance: visualizer page has a Lighthouse budget enforced in CI (LCP < 2.5s, CLS < 0.1). Failing budgets block merge.

### What we explicitly don't test

- Full content corpus end-to-end — too brittle, too slow. Content correctness is enforced via schema validation (zod on YAML at build time) and a build-time link checker.
- Third-party services (Google OAuth, Neon, Upstash) — mocked at the boundary. We trust their SLAs.

## 12. Deployment and environments

- Environments: `dev` (local Docker Compose), `preview` (per-PR Vercel + Fly preview machines), `prod`.
- **Web** (`apps/web`): Vercel.
- **API** (`apps/api`): Fly.io with 2 small machines behind a load balancer; horizontal autoscale on CPU. Multi-stage Dockerfile.
- **Docs** (`apps/docs`): Cloudflare Pages. Static build (`pnpm --filter docs build` → `apps/docs/.vitepress/dist`). Custom domain `docs.<your-domain>`.
- DB: Neon (branching per preview env is a huge dev-loop win).
- CDN: Cloudflare in front of api.* for cacheable GETs.
- Secrets: Vercel/Fly/Cloudflare env vars; nothing in repo.
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

## 16. Dev tooling

Tooling choices follow the same axis as the framework decision: **stable + maintainable** over novel.

### Local development
- **Docker Compose** for backing services (Postgres 17, Redis). Apps run on the host via `pnpm dev` so HMR is instant. Compose file lives at repo root; `make dev` is the single entry point.
- **Node version** pinned via `.nvmrc` and `engines.node` in `package.json`.
- **Package manager:** pnpm (workspaces).

### Monorepo orchestration
- **Turborepo** for task running and caching across `apps/*` and `packages/*`. Caching is real value even at 2 apps + 3 packages — typecheck/build/test stays fast as the repo grows. `Nx` rejected as overkill for this scale.

### Command surface
- **Makefile** at repo root wraps the messy reality (`docker compose`, `pnpm -w turbo run …`, `prisma migrate`, `playwright`) behind a small set of human commands:
  - `make dev` — bring up Compose + run all apps in dev
  - `make stop` — tear down Compose
  - `make db.migrate` / `make db.reset` / `make db.seed` / `make db.studio`
  - `make lint` / `make typecheck` / `make test` / `make e2e`
  - `make build` — turbo build (web + api)
  - `make docker.api` — build prod API image locally
- Make is universal, fish-shell-friendly, and adds zero deps. `justfile` rejected to avoid an extra tool install.

### Code hygiene
- **ESLint + Prettier** — boring, well-supported across NestJS + Next.js plugins. Biome rejected (still maturing).
- **Husky + lint-staged** for pre-commit format/lint on staged files only.
- **commitlint** with Conventional Commits config — gives free changelogs later via `release-please` or similar.
- **TypeScript** in strict mode, project references for incremental builds.

### Env vars
- `.env.example` checked in; real `.env` files in `.gitignore`.
- **zod-validated env schema** loaded at NestJS bootstrap (and in Next.js via `@t3-oss/env-nextjs` or hand-rolled). Boot fails fast on missing/invalid vars.

### CI/CD
- **GitHub Actions** workflows:
  - `ci.yml` on every PR: install → lint → typecheck → unit + integration tests (Postgres service container) → build.
  - `e2e.yml` on PR with label or main: spin up app + Playwright.
  - `deploy-web.yml` is implicit via Vercel's GitHub integration (preview per PR, prod on main).
  - `deploy-api.yml` on main: build Docker image, push, `flyctl deploy`.
- Secrets in GitHub Actions secrets store; nothing in repo.

### Production containers
- **API:** multi-stage Dockerfile in `apps/api/Dockerfile` — stage 1 installs full deps and builds, stage 2 copies `dist/` + production deps onto a slim Node base. Final image target: <200 MB.
- **Web:** no Dockerfile — Vercel builds Next.js natively.

### Explicitly skipped
- Nx, Bun in production, Biome, devcontainers, Lerna/Changesets, Doppler — see "What I'd skip" rationale in design conversation. Revisit when team or scope grows.

## 17. Documentation site (VitePress)

A standalone VitePress app at `apps/docs` serves project documentation: architecture, API reference, dev setup, ops runbooks, ADRs. Treated as a peer to `apps/web` and `apps/api` — same repo, independent build, independent deploy.

### Why VitePress (and why a separate app)
- Static-site generator — build output is plain HTML/JS/CSS, served from any CDN for free. No runtime, no DB, no auth, no scaling concerns.
- Markdown-first authoring — contributors edit `.md` files; same review workflow as code.
- Vue-based, but at runtime only the docs site uses Vue. The main web app stays React. pnpm workspaces keep their dep trees independent so neither bloats the other.
- Lives in the same repo as code: docs PRs ride alongside the code change that needed them, atomic commits, single source of truth.

### Layout

```
apps/docs/
├── .vitepress/
│   ├── config.ts          nav, sidebar, theme, search, head
│   └── theme/             custom components if/when needed
├── index.md               landing
├── guide/
│   ├── getting-started.md
│   ├── monorepo-layout.md
│   ├── local-dev.md       Docker Compose, make targets
│   └── content-authoring.md   how to add an algorithm YAML
├── architecture/
│   ├── overview.md        mirrors §3
│   ├── domain-model.md
│   ├── frontend.md
│   ├── backend.md
│   ├── database.md
│   ├── visualizer.md
│   └── auth.md
├── api/
│   ├── overview.md
│   └── reference.md       auto-rendered from OpenAPI spec
├── ops/
│   ├── deployment.md
│   ├── runbook.md         oncall: DB down, API 5xx, cache eviction
│   └── observability.md
├── contributing/
│   ├── conventions.md
│   ├── testing.md
│   └── commit-style.md
└── decisions/
    └── adr-0001-nestjs-over-fastify.md
```

### Tooling

- **Search:** VitePress built-in local search (Minisearch). No third-party signup. Upgrade to Algolia DocSearch later if traffic warrants.
- **Diagrams:** `vitepress-plugin-mermaid` for architecture/sequence diagrams in fenced code blocks.
- **API reference:** generate Markdown from the OpenAPI spec emitted by `@nestjs/swagger`. A small build step (`pnpm --filter docs gen:api`) reads `apps/api/openapi.json` and writes `apps/docs/api/reference.md`. Runs in CI before docs build.
- **ADRs:** lightweight — one decision per file, ~200 words. Sidebar auto-lists `decisions/`. Captures *why* — far cheaper than reconstructing later.
- **Dev:** `pnpm --filter docs dev` runs on a separate port from web/api.
- **Build:** `pnpm --filter docs build` → `apps/docs/.vitepress/dist`.

### Deploy

- Cloudflare Pages, custom domain `docs.<your-domain>`.
- GitHub Actions workflow `deploy-docs.yml` on `main`: regenerate API reference from the latest OpenAPI spec, build, push.
- Build is fast (<60s) and free; no preview-deploy gating needed but Cloudflare Pages auto-creates previews per PR.

### Cross-linking with the main site

- Main site footer gets a "Docs" link to the VitePress site.
- VitePress nav links back to the main site landing.
- No shared build pipeline — loose URLs only. This is intentional: keeps the docs site simple and decoupled.

## 18. API deep structure (`apps/api`)

Detailed structure for the NestJS API: libraries, folder layout, module principles, cross-cutting patterns, and the request lifecycle.

### 18.1 Library inventory

| Concern | Pick | Rationale |
|---|---|---|
| HTTP adapter | `@nestjs/platform-express` | Largest plugin/middleware ecosystem; Fastify adapter rejected (perf we don't need, smaller middleware pool). |
| Config + env | `@nestjs/config` + **zod** | Validate env at boot via zod schema; fail fast on missing/invalid vars. |
| Validation | **zod** + **nestjs-zod** | Schemas live in `packages/shared` and are shared with web; type = schema. Bridges to Swagger. Rejected `class-validator` (no monorepo schema sharing). |
| OpenAPI | `@nestjs/swagger` + `nestjs-zod` | Auto-generates OpenAPI 3.1; Swagger UI in non-prod; `openapi.json` emitted for docs site. |
| ORM | `prisma`, `@prisma/client`, **`nestjs-prisma`** | Locked. `nestjs-prisma` provides clean module + lifecycle. |
| Auth — Google verify | **`google-auth-library`** | First-party. Replaces unmaintained passport-google-id-token. |
| Auth — JWT | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | Standard NestJS auth stack with `JwtAuthGuard` + `JwtStrategy`. |
| Cookies | `cookie-parser` | Read httpOnly auth cookies. |
| Cache | `@nestjs/cache-manager` + `cache-manager` + `cache-manager-redis-yet` | Redis-backed Nest cache abstraction. |
| Rate limiting | `@nestjs/throttler` (Redis storage) | Per-IP and per-user across instances. |
| Health | `@nestjs/terminus` | `/healthz` liveness + `/readyz` readiness with Postgres/Redis pings. |
| Logging | **`nestjs-pino`** | Structured JSON, request-scoped logger with request ID, fast. |
| Tracing/metrics | `@opentelemetry/sdk-node` + auto-instrumentations | HTTP/Prisma/Redis spans; OTLP to Grafana Cloud. |
| Errors | `@sentry/node` + `@sentry/profiling-node` | Error sink + APM via global exception filter. |
| Security headers | `helmet` | Standard. |
| Compression | `compression` | Gzip responses. |
| Cron | `@nestjs/schedule` | Refresh-token cleanup, cache warm-up. |
| Date/time | `dayjs` | Tiny, sane API. |
| IDs | `cuid2` (or Prisma default `cuid`) | Short, sortable, URL-safe. |
| HTTP testing | `supertest` | Standard. |
| Test containers | `testcontainers` | Real Postgres + Redis in integration tests. |
| Test runner | `vitest` | Same runner across the monorepo. |
| Dev runner | `tsx` (or `nest start --watch`) | Fast TS execution with watch. |

### 18.2 Folder structure

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                         ingest content/*.yaml → DB
├── src/
│   ├── main.ts                         OTel init, Nest bootstrap, global pipes/filters
│   ├── app.module.ts                   Root composition
│   │
│   ├── common/                         Cross-cutting (no domain logic)
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── public.decorator.ts            opt-out of JwtAuthGuard
│   │   │   └── api-paginated.decorator.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts       uniform error JSON
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── cache.interceptor.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts         from nestjs-zod
│   │   ├── dtos/
│   │   │   ├── pagination.dto.ts
│   │   │   └── error.dto.ts
│   │   └── utils/
│   │
│   ├── infra/                          Infrastructure modules (mostly @Global)
│   │   ├── config/
│   │   │   ├── config.module.ts
│   │   │   ├── env.schema.ts                  zod env schema
│   │   │   └── config.service.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── cache/
│   │   │   ├── cache.module.ts
│   │   │   └── cache.service.ts
│   │   ├── logger/
│   │   │   └── logger.module.ts               nestjs-pino wired here
│   │   ├── throttler/
│   │   │   └── throttler.module.ts            Redis-backed
│   │   └── telemetry/
│   │       ├── telemetry.module.ts
│   │       ├── tracing.ts                     OTel SDK init
│   │       └── sentry.ts
│   │
│   └── modules/                        Feature (domain) modules
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts             POST /v1/auth/{google,refresh,logout}
│       │   ├── auth.service.ts
│       │   ├── strategies/jwt.strategy.ts
│       │   ├── google/google-verifier.service.ts
│       │   ├── dto/{google-login.dto.ts, token-pair.dto.ts}
│       │   └── __tests__/auth.service.spec.ts
│       │
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.service.ts
│       │   └── users.repository.ts             Prisma access for User
│       │
│       ├── catalog/                            Read-mostly hierarchy
│       │   ├── catalog.module.ts               aggregates submodules
│       │   ├── puzzles/{puzzles.module.ts, puzzles.controller.ts, puzzles.service.ts}
│       │   ├── methods/...
│       │   ├── sets/...
│       │   └── cases/...
│       │
│       ├── scramble/
│       │   ├── scramble.module.ts
│       │   ├── scramble.controller.ts          GET /v1/scramble, /v1/scramble/case/:id
│       │   └── scramble.service.ts             uses cube-core from packages/
│       │
│       ├── search/
│       │   ├── search.module.ts
│       │   ├── search.controller.ts
│       │   └── search.service.ts               Postgres FTS + trigram in v1
│       │
│       ├── me/
│       │   ├── me.module.ts
│       │   ├── me.controller.ts                GET/PUT/DELETE /v1/me/*
│       │   ├── me.service.ts
│       │   └── dto/update-algorithm.dto.ts
│       │
│       └── health/
│           ├── health.module.ts
│           └── health.controller.ts            /healthz, /readyz
│
├── test/
│   ├── integration/
│   │   ├── auth.integration.spec.ts
│   │   ├── catalog.integration.spec.ts
│   │   ├── me.integration.spec.ts
│   │   └── scramble.integration.spec.ts
│   ├── contract/
│   │   └── openapi.snapshot.spec.ts            pin OpenAPI shape
│   ├── e2e/                                    optional; mostly handled by web/e2e
│   ├── fixtures/seed-test.ts
│   └── helpers/{app-factory.ts, test-containers.ts}
│
├── Dockerfile                          multi-stage
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
└── openapi.json                        emitted at build, consumed by docs site
```

### 18.3 Module organization principles

- **One Nest module per top-level resource.** Module boundary = REST resource boundary = directory boundary. No circular module imports.
- **`infra/*` modules are global** (`@Global()` where appropriate) — injectable anywhere without re-importing. Keeps feature modules clean.
- **`common/*` has no DI scope** — pure utilities, decorators, filters, pipes.
- **Catalog uses a parent module + four submodules** so puzzles/methods/sets/cases share fixtures and tests but stay individually testable.
- **Layered per module:** Controller (HTTP shape) → Service (domain logic) → Repository (data access). Repository is **optional** — trivial CRUD reads call Prisma directly from the service. Add a repository only when there's reusable query logic or tests need to mock the data layer.

### 18.4 Cross-cutting patterns

- **Validation.** A single global `ZodValidationPipe` from `nestjs-zod`. Schemas live in `packages/shared/schemas/`. nestjs-zod auto-generates Swagger entries. Zero DTO duplication.
- **Auth flow.** Web does OAuth → POSTs Google ID token to `/v1/auth/google` → `GoogleVerifierService` validates signature/`aud`/`iss`/`exp` → `AuthService` upserts User, mints `{access 15m, refresh 30d}` → web stores in httpOnly cookies. Subsequent requests carry access JWT; `JwtAuthGuard` is global (`APP_GUARD`); routes opt out via `@Public()`. `@CurrentUser()` extracts user from request.
- **Caching.** Two layers: HTTP `Cache-Control: public, s-maxage=600` on reads (Cloudflare CDN does most of the work) + `@nestjs/cache-manager` Redis backend for cache-miss recovery in-process. Cache keys content-hash-suffixed — invalidation = bump the seed hash on content changes.
- **Errors.** Global `AllExceptionsFilter` returns `{ error: { code, message, details? }, requestId }`. Domain exceptions (`CaseNotFoundException`, `AlreadyLearnedException`) extend `HttpException` with stable error codes. Sentry captures 5xx with Pino breadcrumbs.
- **Logging.** `nestjs-pino` — pretty transport in dev, JSON in prod. Each request has a `requestId` (generated or read from `x-request-id`). `LoggingInterceptor` logs `method path status durationMs userId?` once per request.
- **Rate limiting.** `@nestjs/throttler` with Redis storage. Defaults: 60 req/min/IP public, 120 req/min/user authed, 10 req/min/IP on `/v1/auth/*`. Override per-controller with `@Throttle()`.
- **Observability.** OpenTelemetry SDK initialized **before** Nest bootstrap in `main.ts` so auto-instrumentation activates during DI. OTLP export to Grafana Cloud. Sentry alongside for errors + transactions.
- **Health.** Terminus `/healthz` (process up) + `/readyz` (Postgres + Redis pings). Fly.io health-check points at `/readyz` with 5s timeout.
- **Versioning.** `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. All controllers `@Controller({ path: '…', version: '1' })`. v2 can coexist later.
- **OpenAPI.** `@nestjs/swagger` + `nestjs-zod`. Swagger UI at `/v1/docs` only when `NODE_ENV !== 'production'`. `pnpm --filter api openapi:emit` writes `openapi.json` at build for VitePress docs site to render.

### 18.5 Request lifecycle

```
client
  │
  ▼  HTTPS (Cloudflare) ──────── public GET? cache hit ──► return
  │                          miss
  ▼
api.fly.io
  │
  ├─ helmet + compression + cookie-parser (Express middleware)
  ├─ ThrottlerGuard (Redis counters)
  ├─ JwtAuthGuard (unless @Public)
  ├─ ZodValidationPipe (body, params, query)
  ├─ LoggingInterceptor (start)
  ├─ CacheInterceptor (Redis lookup for marked routes)
  │
  ▼
Controller → Service → (Repository) → Prisma → Postgres
  │                                          ↘ Redis
  ▼
ResponseSerializer (Nest default + nestjs-zod)
LoggingInterceptor (end, log line)
AllExceptionsFilter (only if thrown)
  │
  ▼
client ◄── JSON  (+ optional Set-Cookie for auth)

Out of band: OpenTelemetry spans → Grafana Cloud
            Sentry breadcrumbs/errors → Sentry
            pino log lines (stdout) → Fly log shipper → Grafana Loki
```

## 19. Web deep structure (`apps/web`)

Detailed structure for the Next.js frontend: libraries, folder layout, routing/rendering, data fetching, auth, visualizer integration, styling, SEO, performance, testing.

UI is **shadcn/ui first**. TanStack libraries are picked **per-merit, not per-ecosystem**: kept where they're best-in-class (Query, Table, Virtual, Pacer); rejected where a more mature alternative wins (Zustand for client state, React Hook Form for forms — the latter being shadcn's officially documented form library).

### 19.1 Library inventory

| Concern | Pick | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSG/SSR/RSC native; SEO is the growth engine. |
| React | React 19 | Server Components, `use()`, form actions, Compiler-ready. |
| **UI primitives + components** | **shadcn/ui** (CLI-installed, copied into `src/components/ui/`) | Built on Radix + Tailwind + `cva` + `tailwind-merge`; components owned in repo, no version lock-in. Radix etc. are transitive choices, not separate picks. |
| Styling | Tailwind v4 (CSS-first, `@theme`) | Fast, no postcss config needed. |
| Class composition | `clsx` + `tailwind-merge` (via `cn()`) | shadcn convention. |
| Icons | `lucide-react` | shadcn's default. |
| Toasts | `sonner` | shadcn-recommended; tiny, animated, accessible. |
| Command palette | `cmdk` | shadcn-recommended; no TanStack equivalent. |
| **Tables** | **`@tanstack/react-table` v8** | Headless, type-safe; rendered through shadcn `<Table>` skin. Used on `/me/algorithms`, `/search`, future admin. |
| **Virtualization** | **`@tanstack/react-virtual`** | Long lists (algorithm sheet at scale, search results, future trainer history). |
| **Forms** | **`react-hook-form`** + `@hookform/resolvers/zod` | shadcn's `<Form>` is officially built on RHF; copy-paste-ready. Maturity (~7M weekly downloads, 6+ years) decisive over TanStack Form for our flat, simple forms. Reuses `packages/shared` zod schemas. |
| **Server state** | **`@tanstack/react-query` v5** (+ devtools) | Used for client-side mutations (`/me/*`); RSC handles most reads with `<HydrationBoundary>` for handoff. |
| **Client state / state machines** | **`zustand`** v5 (with `persist`, `devtools` middleware) | Timer state machine + visualizer playback controls. Picked over TanStack Store on maturity (~5M weekly downloads, 4+ years), middleware ecosystem (persist for localStorage of times history is one line), and Redux DevTools support. |
| **Debounce/throttle** | **`@tanstack/react-pacer`** | Palette and `/search` input. |
| Auth (web side) | Auth.js v5 (`next-auth`) | Google OAuth handshake; POSTs Google ID token to api `/v1/auth/google`, receives api JWTs, sets httpOnly cookies. Api remains source of truth. |
| Validation | `zod` (shared) | Same schemas as api. End-to-end type safety. |
| Markdown render | `react-markdown` + `remark-gfm` + `rehype-sanitize` | For `recognition_md`, `personal_notes_md` from api. |
| 3D | three.js + `@react-three/fiber` + `@react-three/drei` (via `packages/visualizer`) | Lazy-loaded, `ssr: false`. |
| Dates | `dayjs` | Matches api. |
| SEO | Next.js Metadata API + dynamic `app/sitemap.ts` | Sitemap calls api at build for the catalog tree. |
| Dynamic OG | Next 15 `opengraph-image.tsx` (uses `next/og`) | Per-case cube state image. |
| Fonts | `next/font/google` (Inter + JetBrains Mono) | Self-hosted, zero CLS. |
| Bundle analysis | `@next/bundle-analyzer` | On-demand via `ANALYZE=1`. |
| Errors | `@sentry/nextjs` | Source maps, RSC support. |
| Server logging | `pino` via `instrumentation.ts` | Matches api log shape. |
| Analytics | TBD (`@vercel/analytics` quick win, or Plausible) | Open question §14. |
| Testing | `vitest` + `@testing-library/react` + `user-event` + `@playwright/test` | Same runner across monorepo. |
| Storybook | `storybook` + `@storybook/nextjs` | Visual review for `CubeVisualizer`, `CaseCard`, `SetGrid`, data-table wrapper. |

**Routing stays on Next.js App Router** (not TanStack Router) — RSC + SSG are non-negotiable for SEO and the catalog content size.

### 19.2 Folder structure

```
apps/web/
├── public/
│   ├── og/                              base OG fallbacks
│   ├── favicon.ico, icon.png, apple-icon.png
│   └── robots.txt                       (or via app/robots.ts)
│
├── src/
│   ├── app/                             App Router
│   │   ├── layout.tsx                   root: fonts, providers, theme, head defaults
│   │   ├── page.tsx                     landing
│   │   ├── globals.css                  Tailwind v4 @theme tokens
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── loading.tsx
│   │   ├── sitemap.ts                   build-time fetch from api
│   │   ├── robots.ts
│   │   ├── manifest.ts
│   │   │
│   │   ├── (marketing)/                 group: no app chrome
│   │   │   └── about/page.tsx
│   │   │
│   │   ├── (app)/                       group: main app chrome
│   │   │   ├── layout.tsx
│   │   │   ├── 3x3/
│   │   │   │   ├── page.tsx                       puzzle hub
│   │   │   │   └── [method]/                      /3x3/cfop
│   │   │   │       ├── page.tsx                   method overview
│   │   │   │       └── [set]/                     /3x3/cfop/pll
│   │   │   │           ├── page.tsx               grid of cases
│   │   │   │           └── [case]/                /3x3/cfop/pll/t-perm
│   │   │   │               ├── page.tsx           case detail (RSC + hydrated visualizer)
│   │   │   │               └── opengraph-image.tsx  dynamic OG
│   │   │   ├── timer/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   └── me/
│   │   │       ├── layout.tsx           auth gate
│   │   │       └── algorithms/page.tsx  TanStack Table + virtual
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   │
│   │   ├── embed/
│   │   │   └── visualizer/page.tsx      iframe variant — no chrome
│   │   │
│   │   └── api/
│   │       └── auth/[...nextauth]/route.ts        Auth.js handler
│   │
│   ├── components/
│   │   ├── ui/                          shadcn primitives (Button, Input, Table, Dialog, …)
│   │   ├── data-table/                  reusable shadcn-skinned TanStack Table wrapper
│   │   ├── form/                        shadcn `<Form>` (built on react-hook-form) field components
│   │   ├── layout/                      Header, Footer, NavRail, ThemeToggle
│   │   ├── algorithm/                   AlgorithmNotation, CaseCard, SetGrid, RecognitionCard
│   │   ├── cube/                        client wrappers over packages/visualizer
│   │   ├── timer/                       Timer, ScrambleDisplay, TimesList
│   │   ├── search/                      SearchInput, ResultList, CommandPalette
│   │   └── progress/                    LearnedBadge, MasteryDial
│   │
│   ├── features/
│   │   ├── catalog/{api.ts, queries.ts}              TanStack Query keys + options
│   │   ├── auth/{auth-options.ts, session.ts, current-user.ts}
│   │   ├── me/
│   │   │   ├── api.ts
│   │   │   ├── hooks.ts                              useMyAlgorithms, useUpdateAlgorithm
│   │   │   └── tables/algorithms-table.tsx          TanStack Table column defs + virtualized rows
│   │   ├── timer/store.ts                            zustand store + persist middleware
│   │   ├── scramble/api.ts
│   │   └── search/api.ts                             pacer-debounced fetcher
│   │
│   ├── lib/
│   │   ├── api-client.ts                fetch wrapper, auth header, error mapping
│   │   ├── env.ts                       client/server env loader (zod)
│   │   ├── cn.ts                        tailwind-merge + clsx helper
│   │   ├── seo.ts                       generateMetadata helpers
│   │   ├── jsonld.ts                    schema.org/HowTo helpers
│   │   └── format.ts
│   │
│   ├── providers/
│   │   ├── query-provider.tsx           TanStack Query + devtools
│   │   ├── theme-provider.tsx
│   │   └── analytics-provider.tsx
│   │
│   ├── styles/                          (if more than globals.css)
│   │   └── tokens.css
│   │
│   ├── types/shared.ts                  re-export from packages/shared
│   │
│   └── instrumentation.ts               Sentry + pino server-side init
│
├── tests/                               unit / component
├── e2e/                                 Playwright
├── .storybook/{main.ts, preview.tsx}
├── components.json                      shadcn CLI config
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

### 19.3 Routing and rendering strategy

- **Default: Server Components.** Catalog pages are SSG with `revalidate = 600` and on-demand revalidation when content changes.
- **Client Components only where needed:** visualizer, timer, command palette, mutation forms. Lazy-loaded.
- **`/me/*`** are Server Components that read session and forward JWT to api server-side; mutations inside use TanStack Query.
- **`/embed/visualizer`** is its own minimal layout, sized via `postMessage` from host pages.
- **Route groups** (`(app)`, `(auth)`, `(marketing)`) carry different layouts without affecting URLs.
- **Typed routes** via `experimental.typedRoutes` — `Link href` is type-checked.

### 19.4 Data fetching pattern

- **Server Components** call api directly via typed `apiClient` (reads cookie/service token server-side). No JS shipped.
- **Client Components** that need server state use TanStack Query, hydrated with `<HydrationBoundary>` from RSC.
- All response types come from `packages/shared` zod schemas — schema mismatch is a build error.
- `apiClient` retries once on 401 by hitting `/v1/auth/refresh` server-side, then surfaces the error.

### 19.5 Auth on web

- Auth.js v5 with **Google provider only**.
- `signIn` callback POSTs Google ID token to api `/v1/auth/google`; api returns access + refresh JWTs.
- Web stores api access JWT in httpOnly, Secure, SameSite=Lax cookie. Auth.js session cookie also set so `useSession()` works.
- `getCurrentUser()` server helper used by Server Components and the `/me/*` layout's auth gate.
- Sign-out clears both cookies and POSTs `/v1/auth/logout` to api.

### 19.6 Visualizer integration

- Source in `packages/visualizer`. Web imports `<Visualizer/>` via `next/dynamic` with `ssr: false` — three.js never runs on the server.
- `<CubeVisualizer/>` (web wrapper) handles props normalization + suspense fallback (a static SVG of the start state).
- For the **set grid** (e.g., 21 PLLs on one page), web renders **SVG sticker diagrams** as Server Components — zero hydration cost. Only the case detail page hydrates 3D.

### 19.7 Styling and design system

- Tailwind v4 — `@theme` in `globals.css` defines tokens (colors, fonts, spacing, radii, shadows). No `tailwind.config.ts`.
- Light + dark via CSS custom props + `prefers-color-scheme` + manual toggle.
- shadcn/ui owned in `components/ui/`. Customize freely; no external version lock.
- Notation in JetBrains Mono; UI in Inter — both via `next/font/google`.

### 19.8 SEO and structured data

- `generateMetadata({ params })` per route emits title/description/canonical/OG.
- Case page emits JSON-LD `schema.org/HowTo` (steps = moves) for rich Google results.
- `app/sitemap.ts` calls api `/v1/sitemap` (URL list from catalog tree) at build.
- `app/robots.ts` allows everything except `/embed/*` and `/me/*`.
- Per-case dynamic OG image via `opengraph-image.tsx` — renders the cube state.

### 19.9 Performance budget

- LCP < 2.5s on 4G; CLS < 0.1; INP < 200ms.
- Non-visualizer JS budget: <200kb gzipped.
- Visualizer chunk: lazy, ~200kb additional, only on case pages.
- Bitmap images via `next/image`; fonts self-hosted; edge runtime where it pays (sitemap, robots).
- `@next/bundle-analyzer` on `ANALYZE=1`.

### 19.10 Testing

- **Component:** Vitest + Testing Library. Mocks for `next/navigation`, `next/headers`. Fixtures shared with api.
- **E2E:** Playwright — `browse → case → sign in → mark learned → see in /me`; timer; search; embed iframe sizing.
- **Visual:** Storybook for `CubeVisualizer`, `CaseCard`, `SetGrid`, `data-table`. Snapshots in CI on `main` / labeled PRs.
- **Accessibility:** axe checks in Playwright; reduced-motion variant covered.

### 19.11 Observability

- `@sentry/nextjs` with source maps; client + server errors captured.
- `instrumentation.ts` initializes pino server-side for request logs (matches api log shape).
- Web Vitals reported to analytics provider.

## 20. Packages deep structure

Three workspace packages: `cube-core` (puzzle logic), `visualizer` (rendering), `shared` (DTO contracts). All pure TypeScript, no Node-specific or React-specific code unless explicitly stated.

### 20.1 `packages/cube-core`

Pure 3x3 puzzle model. **No React, no Node-specific APIs**, runs anywhere. Heart of correctness — the visualizer, scrambler, recognizer, and future solver all lean on it.

#### Responsibilities
- Cube state representation (two coexisting models, derivable from each other).
- Move parsing from WCA notation.
- Move application + algorithm operations (inverse, mirror, conjugate, commutator, cancel/normalize).
- Algorithm metrics (HTM, STM, ETM).
- Recognition: state → which case (PLL/OLL/F2L).
- Scramble generation (WCA-style + "scramble into a specific case").
- A `Puzzle<TState, TMove>` interface so 4x4 / Megaminx / Pyraminx can plug in later without consumer changes.

#### State models

| Model | Representation | Used for |
|---|---|---|
| **Piece model** (canonical) | 8 corners {pos 0–7, ori 0–2}, 12 edges {pos 0–11, ori 0–1}; backed by typed arrays for allocation-free hot paths | Move application, hashing, equality, recognition |
| **Sticker model** (rendering) | 54-sticker `string[54]`, faces UFRDLB row-major | Visualizer, recognition fingerprints, on-the-wire format |

Conversions both ways are pure functions.

#### Move set (3x3 WCA)

Face turns U/R/F/D/L/B with `'`, `2`; wide turns Uw/Rw/Fw/Dw/Lw/Bw; slices M/E/S; rotations x/y/z. All with prime + double variants.

#### Folder structure

```
packages/cube-core/
├── src/
│   ├── index.ts                      barrel
│   ├── types.ts                      Move, Face, Algorithm, State
│   ├── puzzle/
│   │   ├── puzzle.interface.ts       generic Puzzle<TState, TMove>
│   │   └── puzzle-3x3.ts             concrete 3x3 implementation
│   ├── moves/
│   │   ├── tokenizer.ts              string → tokens
│   │   ├── parser.ts                 tokens → Move[]
│   │   ├── moves-3x3.ts              definitions per move (cubies, axis, angle)
│   │   ├── apply.ts                  state + move → state
│   │   ├── inverse.ts
│   │   ├── mirror.ts                 M / S / E axis
│   │   └── cancel.ts                 R R' → ε,  R R → R2
│   ├── algorithm/
│   │   ├── operations.ts             concat, inverse, mirror, conjugate, commutator
│   │   ├── metrics.ts                HTM, STM, ETM
│   │   └── normalize.ts              cancel + reduce
│   ├── state/
│   │   ├── piece-model.ts
│   │   ├── sticker-model.ts
│   │   ├── conversion.ts             piece ↔ sticker
│   │   ├── solved.ts                 canonical solved state
│   │   ├── equality.ts
│   │   └── hash.ts                   stable string/numeric hash
│   ├── recognition/
│   │   ├── pll.ts                    21 cases, AUF/rotation normalization
│   │   ├── oll.ts                    57 cases
│   │   ├── f2l.ts                    41 cases (per slot)
│   │   └── normalize.ts              shared rotation/AUF helpers
│   └── scramble/
│       ├── wca-3x3.ts                WCA-style random move sequence
│       ├── case-scramble.ts          random pre-state + inverse-of-solution
│       └── rng.ts                    seeded RNG (deterministic for tests)
├── __tests__/
│   ├── apply.spec.ts
│   ├── inverse.spec.ts
│   ├── mirror.spec.ts
│   ├── recognition.spec.ts
│   ├── scramble.spec.ts
│   └── property/                     fast-check
│       ├── inverse.property.ts       any seq + inverse(seq) = solved
│       ├── mirror.property.ts        mirror(mirror(seq)) = seq
│       └── canonicalization.property.ts
├── fixtures/
│   ├── known-scrambles.json          ~20 famous scrambles + states + solutions
│   ├── pll-cases.json                21 case-state fingerprints
│   └── oll-cases.json                57 case-state fingerprints
├── package.json
└── tsconfig.json
```

#### Public API

```ts
import {
  Puzzle3x3,
  parseAlgorithm, applyAlgorithm,
  invertAlgorithm, mirrorAlgorithm, normalizeAlgorithm,
  scrambleWCA, scrambleIntoCase,
  recognizePLL, recognizeOLL, recognizeF2L,
  solvedState, fromStickerString, toStickerString, hashState,
  htm, stm, etm,
} from '@rubik/cube-core'
```

#### Performance + correctness contract

- All hot-path move application allocates zero heap objects. Use typed arrays.
- Coverage floor **≥95%** (locked in §11).
- Property-based tests via fast-check for algebraic identities.
- Known-scrambles corpus (~20) regression-checked on every CI run.

### 20.2 `packages/visualizer`

3D + 2D cube rendering. **Two entry points** so consumers can pull only what they need.

| Entry | Contains | Purpose | RSC-safe? |
|---|---|---|---|
| `@rubik/visualizer/ssr` | SVG sticker diagrams (TopView, F2LView, OLLView, PLLView) | Set grids, search results, OG fallbacks — zero hydration cost | **Yes** |
| `@rubik/visualizer/client` | three.js + R3F `<Visualizer/>`, controls, hooks | Case detail page, embed iframe — interactive 3D | No (`ssr: false` in web) |

#### Tech
- `three`, `@react-three/fiber` v9 (React 19), `@react-three/drei` for OrbitControls/Effects.
- `leva` dev-only for debug GUI.

#### Renderer architecture (the standard, glitch-free approach)

- Scene root contains 27 cubie groups.
- Each cubie = BoxGeometry + sticker meshes per face, materials from a shared color token map.
- Move animation: pluck the 9 cubies on the rotating face into a **transient AnimationGroup**, tween its rotation 90°/180°, then snap rotation onto local cubie positions and re-parent. Avoids floating-point drift over long sequences.
- Tween via a small RAF-driven helper (no GSAP — overkill).

#### Folder structure

```
packages/visualizer/
├── src/
│   ├── index.ts
│   ├── ssr.ts                          re-exports SVG only (RSC-safe surface)
│   ├── client.ts                       re-exports React + three.js (lazy on web)
│   ├── react/
│   │   ├── Visualizer.tsx              top-level <Visualizer/>
│   │   ├── Cube.tsx                    renders 27 cubies into the scene
│   │   ├── Cubie.tsx
│   │   ├── camera/CameraRig.tsx        orbit / perspective presets
│   │   └── hooks/
│   │       ├── usePlayback.ts          state machine (zustand) driving animation
│   │       └── useMoveAnimation.ts     animation lifecycle: pluck → tween → snap
│   ├── three/                          framework-agnostic three.js
│   │   ├── createCubeScene.ts
│   │   ├── animation.ts                move animation primitives
│   │   ├── materials.ts                sticker materials, color tokens
│   │   └── tween.ts                    RAF-driven tween helper
│   ├── svg/
│   │   ├── TopView.tsx                 U-face grid
│   │   ├── F2LView.tsx
│   │   ├── OLLView.tsx                 U-face + top edges of sides
│   │   ├── PLLView.tsx                 with arrows
│   │   └── stickerLayout.ts            cube-core sticker index → SVG coords
│   └── tokens/colors.ts
├── __tests__/
│   ├── animation.spec.ts               pure logic, no DOM
│   └── stickerLayout.spec.ts
├── stories/Visualizer.stories.tsx
├── package.json
└── tsconfig.json
```

#### Public API

```ts
import { Visualizer } from '@rubik/visualizer/client'

<Visualizer
  initialState={stickerString}
  algorithm="R U R' U'"
  speed={1}
  loop={false}
  controls={{ playPause: true, scrub: true, speed: true, camera: 'orbit' }}
  reducedMotion={prefersReduced}
  onMoveChange={(idx) => ...}
/>

import { TopView, PLLView } from '@rubik/visualizer/ssr'

<PLLView state={stickerString} arrows />
```

#### Budgets and a11y

- 60fps on a 2020 mid-tier laptop; cold chunk ~200kb gzipped (three.js dominates).
- One scene per page; full dispose on unmount.
- ARIA live region announces "Move 3 of 14: R'".
- Keyboard: Space play/pause, ← → step, +/- speed.
- `prefers-reduced-motion` → static end-state, no animation.

### 20.3 `packages/shared`

Domain contracts. **The truth boundary between web and api.** No React, no Node-specific code.

#### Responsibilities
- All zod schemas for API DTOs.
- Inferred TS types (auto-derived).
- Constants (slugs, learning-status enum).
- Notation formatting helpers (display-side; cube-core handles parsing).
- Generic utilities (slug helpers, Result type).

#### Folder structure

```
packages/shared/
├── src/
│   ├── index.ts                      barrel
│   ├── schemas/
│   │   ├── puzzle.ts                 PuzzleSchema, MethodSchema, SetSchema, CaseSchema, VariantSchema
│   │   ├── user.ts                   UserSchema, UserAlgorithmSchema
│   │   ├── auth.ts                   GoogleLoginSchema, TokenPairSchema
│   │   ├── scramble.ts
│   │   ├── search.ts
│   │   ├── pagination.ts
│   │   ├── error.ts
│   │   └── index.ts
│   ├── types/index.ts                inferred TS types from schemas
│   ├── constants/
│   │   ├── puzzles.ts                PUZZLE_SLUGS as const
│   │   ├── methods.ts
│   │   ├── sets.ts
│   │   └── learning-status.ts
│   ├── notation/
│   │   ├── format.ts                 display formatting (superscripts, spacing)
│   │   ├── normalize.ts              canonicalize whitespace/case for storage
│   │   └── tokens.ts                 regex for syntax highlighting
│   └── utils/
│       ├── slug.ts
│       ├── result.ts                 Result<T, E>
│       └── id.ts
├── __tests__/
├── package.json
└── tsconfig.json
```

#### Schemas as the single source of truth

`CaseSchema` is defined once in `packages/shared/schemas/puzzle.ts`. Web imports it for forms + response parsing. Api imports it for `nestjs-zod` controller validation + Swagger generation. Drift becomes a build error, not a runtime mystery.

### 20.4 Inter-package dependency graph

```
       packages/shared              packages/cube-core
          (no workspace deps)         (no workspace deps)
                  │                          │
                  │                          ▼
                  │                packages/visualizer
                  │                  (deps: cube-core)
                  │                          │
                  ▼                          ▼
            ┌──────────────────────────────────┐
            │ apps/web   (deps: shared, cube-core, visualizer) │
            │ apps/api   (deps: shared, cube-core)             │
            └──────────────────────────────────┘
```

- **shared** and **cube-core** are leaves — independently buildable and testable, no circular-dep risk.
- **visualizer** depends on **cube-core** for the state model + move algebra it animates.
- **web** + **api** consume the leaves they need.
- Turborepo task graph respects this; `turbo run build` builds leaves first.
- **Api never imports visualizer** — server has no need to render. Keeps the api Docker image lean.

## 21. Database schema (Prisma)

Concrete `prisma/schema.prisma`, indexes, raw SQL for FTS + trigram, seed strategy, and dev workflow. Eight tables in v1: `puzzles`, `methods`, `algorithm_sets`, `algorithm_cases`, `algorithm_variants`, `users`, `user_algorithms`, `refresh_tokens`.

### 21.1 Entity overview

```
Puzzle ──▶ Method ──▶ AlgorithmSet ──▶ AlgorithmCase ──▶ AlgorithmVariant
                                            ▲                  ▲
                                            │                  │ chosenVariantId
                                            └── UserAlgorithm ── User ──▶ RefreshToken
```

### 21.2 `prisma/schema.prisma` (complete)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres", "relationJoins"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // bypasses the pooler for migrations on Neon
}

// ============================================================
// Catalog: Puzzle → Method → Set → Case → Variant
// ============================================================

model Puzzle {
  id                  String   @id @default(cuid())
  slug                String   @unique
  name                String
  wcaEventCode        String?
  displayOrder        Int      @default(0)
  stateSchemaVersion  String   @default("v1")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  methods Method[]

  @@map("puzzles")
}

model Method {
  id             String   @id @default(cuid())
  puzzleId       String
  slug           String
  name           String
  descriptionMd  String?
  displayOrder   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  puzzle Puzzle         @relation(fields: [puzzleId], references: [id], onDelete: Cascade)
  sets   AlgorithmSet[]

  @@unique([puzzleId, slug])
  @@index([puzzleId, displayOrder])
  @@map("methods")
}

enum RecognitionBasis {
  LAST_LAYER
  F2L_SLOT
  OLL_ORIENTATION
  PLL_PERMUTATION
  CROSS
  OTHER
}

model AlgorithmSet {
  id                 String           @id @default(cuid())
  methodId           String
  slug               String
  name               String
  caseCountExpected  Int
  recognitionBasis   RecognitionBasis
  displayOrder       Int              @default(0)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  method Method          @relation(fields: [methodId], references: [id], onDelete: Cascade)
  cases  AlgorithmCase[]

  @@unique([methodId, slug])
  @@index([methodId, displayOrder])
  @@map("algorithm_sets")
}

model AlgorithmCase {
  id              String   @id @default(cuid())
  setId           String
  slug            String
  name            String
  displayName     String
  displayOrder    Int      @default(0)
  caseState       String   // 54-char sticker string (face order UFRDLB)
  recognitionMd   String?
  tags            String[] @default([])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  set            AlgorithmSet       @relation(fields: [setId], references: [id], onDelete: Cascade)
  variants       AlgorithmVariant[]
  userAlgorithms UserAlgorithm[]

  @@unique([setId, slug])
  @@index([setId, displayOrder])
  @@index([tags], type: Gin)
  // search_vector tsvector + GIN index added via raw migration (see §21.3)
  @@map("algorithm_cases")
}

model AlgorithmVariant {
  id             String   @id @default(cuid())
  caseId         String
  notation       String
  moveCountHtm   Int
  moveCountStm   Int
  isPrimary      Boolean  @default(false)
  attribution    String?
  fingertrickMd  String?
  displayOrder   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  case             AlgorithmCase   @relation(fields: [caseId], references: [id], onDelete: Cascade)
  chosenByUserAlgs UserAlgorithm[] @relation("UserAlgorithm_chosenVariant")

  @@index([caseId, displayOrder])
  @@map("algorithm_variants")
}

// ============================================================
// Users + Auth
// ============================================================

model User {
  id          String    @id @default(cuid())
  email       String    @unique
  displayName String?
  googleSub   String    @unique
  avatarUrl   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  lastLoginAt DateTime?

  algorithms    UserAlgorithm[]
  refreshTokens RefreshToken[]

  @@map("users")
}

enum LearningStatus {
  LEARNING
  LEARNED
  MASTERED
}

model UserAlgorithm {
  userId          String
  caseId          String
  chosenVariantId String?
  status          LearningStatus @default(LEARNING)
  personalNotesMd String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  case          AlgorithmCase     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  chosenVariant AlgorithmVariant? @relation("UserAlgorithm_chosenVariant", fields: [chosenVariantId], references: [id], onDelete: SetNull)

  @@id([userId, caseId])
  @@index([userId, status])
  @@map("user_algorithms")
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique  // SHA-256 of raw token; raw is never stored
  userAgent String?
  ip        String?
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
  @@map("refresh_tokens")
}
```

### 21.3 Raw SQL migration for FTS + trigram

Prisma doesn't model `tsvector` or `pg_trgm` natively. Add them in `prisma/migrations/<timestamp>_add_fts/migration.sql` (after the auto-generated DDL):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Generated tsvector column on algorithm_cases (no triggers needed)
ALTER TABLE algorithm_cases
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(recognition_md, '')), 'C')
  ) STORED;

CREATE INDEX algorithm_cases_search_vector_idx
  ON algorithm_cases USING GIN (search_vector);

-- Trigram for fuzzy "T per..." → "T-Perm" matching
CREATE INDEX algorithm_cases_name_trgm_idx
  ON algorithm_cases USING GIN (name gin_trgm_ops);
CREATE INDEX algorithm_cases_display_name_trgm_idx
  ON algorithm_cases USING GIN (display_name gin_trgm_ops);
```

`SearchService` queries via `$queryRaw` blending `ts_rank_cd(search_vector, ...) + similarity(name, q)` for relevance, with trigram indexes handling typo tolerance.

### 21.4 Index summary

| Table | Index | Purpose |
|---|---|---|
| `puzzles` | `slug` unique | URL routing `/3x3/...` |
| `methods` | `(puzzleId, slug)` unique | URL routing `/3x3/cfop/...` |
| `methods` | `(puzzleId, displayOrder)` | Ordered list on puzzle hub |
| `algorithm_sets` | `(methodId, slug)` unique | URL routing `.../cfop/pll/...` |
| `algorithm_sets` | `(methodId, displayOrder)` | Ordered list on method page |
| `algorithm_cases` | `(setId, slug)` unique | URL routing `.../pll/t-perm` |
| `algorithm_cases` | `(setId, displayOrder)` | Set grid ordering |
| `algorithm_cases` | `tags` GIN | Tag-filter queries |
| `algorithm_cases` | `search_vector` GIN | Full-text search |
| `algorithm_cases` | `name`, `display_name` GIN trgm | Fuzzy/typo search |
| `algorithm_variants` | `(caseId, displayOrder)` | Ordered variants list |
| `users` | `email` unique | Login lookup |
| `users` | `googleSub` unique | OAuth identity |
| `user_algorithms` | `(userId, caseId)` PK | Single status per user/case |
| `user_algorithms` | `(userId, status)` | "Show my learned algs" |
| `refresh_tokens` | `tokenHash` unique | Token verification |
| `refresh_tokens` | `(userId, expiresAt)` | Cleanup + per-user listing |

### 21.5 Extensions

- `pg_trgm` — trigram fuzzy match for search.
- Built-in `english` text-search dictionary — no extension needed.

### 21.6 Connection pooling

- **Prod:** Neon's pooled connection string in `DATABASE_URL`; direct (unpooled) URL in `DIRECT_URL` for migrations. Prisma respects both via `datasource.directUrl`.
- **Local:** plain `postgresql://...@localhost:5432/rubik` — no pooler.
- For high-concurrency batch jobs (e.g., content seed): use `?pgbouncer=true&connection_limit=1` on the pooled URL, or run against `DIRECT_URL`.

### 21.7 Seed strategy

`prisma/seed.ts` is the bridge from git-versioned YAML content to the database:

1. Read `content/puzzles/3x3/methods/cfop/sets/{f2l,oll,pll}/cases/*.yaml`.
2. Validate each file against the zod schema in `packages/shared/schemas/puzzle.ts`. Bad content fails the seed — does not silently corrupt the DB.
3. Upsert in dependency order: Puzzle → Method → Set → Case → Variant.
4. Idempotent — re-running converges to the same DB state. Cases/variants no longer present in YAML are **flagged**, not deleted (deletion requires explicit `--prune`).

Wired via `package.json`:

```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

### 21.8 Dev workflow (Makefile targets)

| Command | What it does |
|---|---|
| `make db.migrate` | `prisma migrate dev` — create + apply a new migration locally |
| `make db.deploy` | `prisma migrate deploy` — apply pending migrations (CI/prod) |
| `make db.reset` | `prisma migrate reset` — drop + recreate + reseed local DB |
| `make db.seed` | `prisma db seed` — re-run YAML → DB ingest |
| `make db.studio` | `prisma studio` — DB GUI |
| `make db.format` | `prisma format` — canonicalize the schema file |

CI runs `prisma migrate deploy` in a one-shot Fly machine before traffic flips; gated by approval for prod.

### 21.9 Cascade and lifecycle rules

- **No soft delete in v1.** Hard delete with cascade. Deleting a user removes their `UserAlgorithm` and `RefreshToken` rows.
- **Catalog cascades** (Puzzle → Method → Set → Case → Variant) are wired with `onDelete: Cascade` so removing a puzzle cleans up downstream — but in practice nothing is deleted from the catalog except via the explicit `--prune` seed flag.
- **`UserAlgorithm.chosenVariantId`** is `onDelete: SetNull` — if a variant is removed, the user's preference reverts to "no preference," not the whole row gone.

### 21.10 Deliberately not modeled in v1

| Not modeled | Why |
|---|---|
| Trainer sessions / drill history | v2 (Trainer feature). |
| Solver-generated solutions | v2 (Solver feature). |
| Public profiles / social | v2. |
| Tags as a separate table | v1 uses `String[]` array; tags don't yet need their own metadata/admin. Migrate to a table when we want tag pages. |
| Audit log | v1 doesn't need it. App-level structured logs cover the audit trail. |
| Multiple OAuth providers per user | v1 is Google-only; `User.googleSub` is sufficient. v2: extract to a `UserIdentity` table. |
| Localization | v1 is English. v2: add `*_translations` tables or a JSONB locale column. |

## 22. Content directory (`content/`)

Git-versioned YAML is the editorial source of truth. The DB is rebuilt from `content/` via the seed pipeline; YAML wins on conflict.

### 22.1 Directory layout

```
content/
├── puzzles/
│   └── 3x3/
│       ├── puzzle.yaml                            puzzle metadata
│       └── methods/
│           └── cfop/
│               ├── method.yaml                    method metadata + description
│               └── sets/
│                   ├── f2l/
│                   │   ├── set.yaml               set metadata
│                   │   └── cases/                 41 files
│                   │       ├── 01-corner-edge-front.yaml
│                   │       └── …
│                   ├── oll/
│                   │   ├── set.yaml
│                   │   └── cases/                 57 files
│                   └── pll/
│                       ├── set.yaml
│                       └── cases/                 21 files
│                           ├── aa-perm.yaml
│                           ├── t-perm.yaml
│                           └── …
│
└── fixtures/                                      minimal subset for tests
    └── puzzles/3x3/methods/cfop/sets/{pll,oll,f2l}/cases/<2 each>.yaml
```

One file per case, one file per set/method/puzzle. Diff-friendly, review-friendly.

### 22.2 YAML schemas

**`puzzle.yaml`**
```yaml
slug: 3x3
name: 3x3 Cube
display_name: 3×3
wca_event_code: "333"
display_order: 0
state_schema_version: v1
```

**`method.yaml`**
```yaml
slug: cfop
name: CFOP
display_order: 0
description_md: |
  CFOP (Cross, F2L, OLL, PLL) is the most popular speedsolving method.
  It builds the cube layer by layer with the last two layers solved
  in two algorithmic stages.
```

**`set.yaml`**
```yaml
slug: pll
name: PLL
display_name: Permutation of Last Layer
case_count_expected: 21
recognition_basis: PLL_PERMUTATION   # enum from §21
display_order: 3
description_md: |
  PLL permutes the pieces of the last layer once they are oriented.
  21 distinct cases.
```

**Case file** (example: `pll/cases/t-perm.yaml`)
```yaml
slug: t-perm
name: T Perm
display_name: T-Perm
display_order: 14
# 54-char sticker string, faces UFRDLB row-major
case_state: "UUUUUUUUU R B R F R F R F R B B B L L L L L L D D D D D D D D D F F F F F F F F F"
recognition_md: |
  Two adjacent headlights on one side; non-matching corners on the right.
  Bar on the left side.
tags:
  - adjacent-corner-swap
  - edge-2-cycle

variants:
  - notation: R U R' U' R' F R2 U' R' U' R U R' F'
    is_primary: true
    attribution: Standard
    fingertrick_md: |
      Start with right hand resting on top. Push R with index, then…
  - notation: x R2 D2 R' U' R D2 R' U R'
    is_primary: false
    attribution: Alternative (regrip-free)
```

### 22.3 Validation (zod, in `packages/shared`)

Content-shape schemas live in `packages/shared/schemas/content.ts`, separate from but parallel to the API DTO schemas in §20.3:

- `PuzzleContentSchema`, `MethodContentSchema`, `SetContentSchema`, `CaseContentSchema`, `VariantContentSchema`.

**File-level rules:**
- `slug` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/` (kebab-case).
- `case_state` is exactly 54 characters in the valid sticker alphabet (whitespace permitted, normalized at parse).
- `tags` are kebab-case.
- `recognition_basis` matches the enum in `prisma/schema.prisma`.

**Cross-file rules** (run after loading all files):
- File path must match `slug` (file `t-perm.yaml` must contain `slug: t-perm`).
- `set.case_count_expected` matches the actual case file count.
- Exactly one variant per case has `is_primary: true`.
- `display_order` is unique within its parent.

**Notation correctness** (uses `packages/cube-core`):
- Each `variant.notation` parses via `parseAlgorithm()` without errors.
- `applyAlgorithm(solvedState, inverse(notation))` produces a state whose visual matches `case_state` — sanity check that the published alg actually solves the case.

Any failure is a hard error in seed AND in a CI job — bad content never lands.

### 22.4 Ingest pipeline (`prisma/seed.ts`)

```ts
// outline
import { glob } from 'glob'
import yaml from 'js-yaml'
import { PrismaClient } from '@prisma/client'
import { PuzzleContentSchema, /* … */ } from '@rubik/shared/content'
import { parseAlgorithm, applyAlgorithm, inverseAlgorithm,
         solvedState, fromStickerString, hashState } from '@rubik/cube-core'

// 1. Discover files via glob.
// 2. Parse each file (js-yaml).
// 3. Validate each with the zod schema.
// 4. Cross-validate (paths, counts, primaries, notation correctness).
// 5. Upsert in dependency order: Puzzle → Method → Set → Case → Variant.
// 6. If --prune, delete DB rows whose slug is no longer in YAML.
```

**CLI flags:**

| Flag | Effect |
|---|---|
| `--validate-only` | Run all validation, skip DB writes. Used in CI. |
| `--puzzle <slug>` | Limit ingest to one puzzle. |
| `--method <slug>` | Limit to one method within a puzzle. |
| `--prune` | Delete DB rows whose slug is no longer in YAML. Without this flag, missing entries are reported as warnings but kept. |
| `--dry-run` | Print the upserts that would happen; do nothing. |

Wired via `package.json`:

```json
{ "prisma": { "seed": "tsx prisma/seed.ts" } }
```

So `prisma db seed` (and `make db.seed`) just works.

### 22.5 Authoring workflow

PR-based, leaning on the same review tools as code:

1. Add or edit a YAML file under `content/`.
2. `make content.validate` (calls `prisma/seed.ts --validate-only`) locally — fast, no DB needed if `--no-db` mode skips upserts entirely.
3. Optional: `make db.seed` to apply locally and click around.
4. Commit + PR.
5. CI runs the same validation. If notation references a case state that doesn't match, the PR fails with a precise error pointing at the file and line.
6. On merge to `main`, the deploy pipeline runs `prisma migrate deploy && prisma db seed` against prod (gated by approval). The web app's on-demand revalidation hook fires for every changed slug.

### 22.6 Make targets

| Command | What it does |
|---|---|
| `make content.validate` | All zod + cross-file checks; no DB writes |
| `make content.diff` | Show DB ⇄ YAML drift (rows in DB but not YAML, and vice versa) |
| `make content.seed` | Alias for `make db.seed` (muscle memory either way) |
| `make content.lint` | Whitespace, ordering, slug-name parity — lint only, no semantic checks |

### 22.7 Deferred

| Deferred | Why |
|---|---|
| Localization (`*_translations`) | v1 English-only. v2: per-locale YAML files or a language column. |
| Media assets (recognition photos, video) | v1: cube state diagram is generated from `case_state` — no extra assets. v2: `content/media/` directory + path references. |
| Per-case OG-image overrides | Auto-generated from state (§19.8). |
| Versioning of historical alg variants | Git history is sufficient; v2 if we want a UI for "see prior version". |
| In-app editing | PRs are the editing UI for v1. v2: admin UI writing to DB with sync-to-YAML, or drop YAML entirely. |
| Multi-puzzle content (Megaminx etc.) | Directory structure already supports it; just author files. |

## 23. Concrete dev-tooling files

The actual `Makefile`, `docker-compose.yaml`, `.dockerignore`, and `apps/api/Dockerfile`. Drop-in once the monorepo is bootstrapped.

### 23.1 `Makefile` (repo root)

```makefile
# rubik-algorithm — top-level Makefile
# Convention: each target ends with `## description`; `help` extracts those.

SHELL       := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM    ?= pnpm
COMPOSE ?= docker compose

# -- Help -------------------------------------------------------------------
.PHONY: help
help: ## Show available targets
	@awk 'BEGIN { FS = ":.*?## " } /^[a-zA-Z0-9_.\-]+:.*?## / \
	      { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# -- Workspace --------------------------------------------------------------
.PHONY: install
install: ## Install all workspace dependencies
	$(PNPM) install

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	$(PNPM) -r exec rm -rf dist .next .turbo .vitepress/dist
	rm -rf node_modules

# -- Local services ---------------------------------------------------------
.PHONY: services.up
services.up: ## Start Postgres + Redis (Docker Compose)
	$(COMPOSE) up -d postgres redis

.PHONY: services.down
services.down: ## Stop and remove all Compose services
	$(COMPOSE) down

.PHONY: services.logs
services.logs: ## Tail Compose service logs
	$(COMPOSE) logs -f postgres redis

# -- Dev --------------------------------------------------------------------
.PHONY: dev
dev: services.up ## Bring up services and run all apps in dev (web + api + docs)
	$(PNPM) -w turbo run dev

.PHONY: stop
stop: services.down ## Alias for services.down

.PHONY: dev.web
dev.web: services.up ## Run only the web app in dev
	$(PNPM) --filter @rubik/web dev

.PHONY: dev.api
dev.api: services.up ## Run only the api in dev
	$(PNPM) --filter @rubik/api start:dev

.PHONY: dev.docs
dev.docs: ## Run only the docs site in dev (no backing services needed)
	$(PNPM) --filter @rubik/docs dev

# -- Database ---------------------------------------------------------------
.PHONY: db.migrate
db.migrate: ## Create + apply a new migration locally (prisma migrate dev)
	$(PNPM) --filter @rubik/api prisma migrate dev

.PHONY: db.deploy
db.deploy: ## Apply pending migrations (CI/prod)
	$(PNPM) --filter @rubik/api prisma migrate deploy

.PHONY: db.reset
db.reset: ## Drop, recreate, and reseed the local DB (destructive)
	$(PNPM) --filter @rubik/api prisma migrate reset --force

.PHONY: db.seed
db.seed: ## Run the YAML → DB seed pipeline
	$(PNPM) --filter @rubik/api prisma db seed

.PHONY: db.studio
db.studio: ## Open Prisma Studio
	$(PNPM) --filter @rubik/api prisma studio

.PHONY: db.format
db.format: ## Canonicalize prisma/schema.prisma
	$(PNPM) --filter @rubik/api prisma format

# -- Content ----------------------------------------------------------------
.PHONY: content.validate
content.validate: ## Validate content/ YAML (no DB writes)
	$(PNPM) --filter @rubik/api tsx prisma/seed.ts --validate-only

.PHONY: content.diff
content.diff: ## Show DB ⇄ YAML drift
	$(PNPM) --filter @rubik/api tsx prisma/seed.ts --dry-run

.PHONY: content.seed
content.seed: db.seed ## Alias for db.seed

.PHONY: content.lint
content.lint: ## Lint content YAML (whitespace, ordering, slug-name parity)
	$(PNPM) --filter @rubik/api tsx scripts/content-lint.ts

# -- Quality ----------------------------------------------------------------
.PHONY: lint
lint: ## Lint all packages
	$(PNPM) -w turbo run lint

.PHONY: typecheck
typecheck: ## TypeScript typecheck across the monorepo
	$(PNPM) -w turbo run typecheck

.PHONY: test
test: ## Run unit + integration tests
	$(PNPM) -w turbo run test

.PHONY: e2e
e2e: ## Run Playwright e2e tests against the running stack
	$(PNPM) --filter @rubik/web exec playwright test

.PHONY: format
format: ## Run prettier across the monorepo
	$(PNPM) -w prettier --write .

# -- Build ------------------------------------------------------------------
.PHONY: build
build: ## Build all apps and packages
	$(PNPM) -w turbo run build

.PHONY: docs.build
docs.build: ## Build the VitePress docs site
	$(PNPM) --filter @rubik/docs build

# -- Docker -----------------------------------------------------------------
.PHONY: docker.api
docker.api: ## Build the production api Docker image locally
	docker build -f apps/api/Dockerfile -t rubik-api:local .

# -- OpenAPI ----------------------------------------------------------------
.PHONY: openapi.emit
openapi.emit: ## Emit apps/api/openapi.json from current controllers
	$(PNPM) --filter @rubik/api openapi:emit
```

### 23.2 `docker-compose.yaml` (repo root)

Local-dev backing services only. Apps run on the host via `pnpm dev` for instant HMR.

```yaml
name: rubik-algorithm

services:
  postgres:
    image: postgres:17-alpine
    container_name: rubik-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: rubik
      POSTGRES_PASSWORD: rubik
      POSTGRES_DB: rubik
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rubik -d rubik"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: rubik-redis
    restart: unless-stopped
    command: ["redis-server", "--save", "60", "1", "--loglevel", "warning"]
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres-data:
  redis-data:
```

Local connection strings (for `.env`):

```
DATABASE_URL=postgresql://rubik:rubik@localhost:5432/rubik
DIRECT_URL=postgresql://rubik:rubik@localhost:5432/rubik
REDIS_URL=redis://localhost:6379
```

### 23.3 `.dockerignore` (repo root)

```
**/node_modules
**/dist
**/.next
**/.turbo
**/.vitepress/dist

.git
.github
docs/
content/

*.log
.env
.env.*
!.env.example

apps/web
apps/docs
```

`apps/web` and `apps/docs` are excluded because they're not needed in the api image. `content/` is excluded because seeding runs as a separate CI job, not from the runtime container.

### 23.4 `apps/api/Dockerfile`

Multi-stage. pnpm-aware. Prisma generate happens during build, not at runtime.

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Stage 1: deps (cache-friendly) ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/cube-core/package.json packages/cube-core/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm --filter @rubik/api exec prisma generate
RUN pnpm -w turbo run build --filter=@rubik/api...

# Extract a production-only subtree.
RUN pnpm --filter @rubik/api deploy --prod --legacy /out

# ---- Stage 3: runtime (slim) ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /out/dist ./dist
COPY --from=build --chown=app:app /out/node_modules ./node_modules
COPY --from=build --chown=app:app /out/package.json ./package.json
COPY --from=build --chown=app:app /repo/apps/api/prisma ./prisma

USER app
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

Target image size: <200 MB (Alpine + node_modules + dist).

### 23.5 Notes

- The Makefile's pnpm filters use `@rubik/*` package names — those names are fixed in §20.3 / §18.2 / §19.2. If you rename a package, update its filter here.
- `db.reset` is destructive (drops local DB) and is the only Make target that warrants the warning. CI never calls it.
- The api Dockerfile is consumed by Fly.io for prod, GitHub Actions for image build, and `make docker.api` for local debugging — same image artifact in all three.
