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
