# Plan 07 — `apps/web`

**Depends on:** 01, 02, 03, 04, 05 (api running for `/me/*` and search; static pages can SSG without it).
**Produces:** the public Next.js 15 site — catalog browsing, case pages with visualizer, timer, search, login, personal algorithm sheet, embed iframe.
**Reference:** §19 (full).

## Goal

A user can browse `/3x3/cfop/pll/t-perm` (SSG), see the case rendered by the visualizer, sign in with Google, mark the case as `learning|learned|mastered`, and see it on `/me/algorithms`. Lighthouse budget per §19.9.

## Deliverables

Top-level shape per §19.2:

```
apps/web/
├── public/
├── src/{app/, components/{ui, data-table, form, layout, algorithm, cube, timer, search, progress},
│       features/{catalog,auth,me,timer,scramble,search}, lib/, providers/, types/, instrumentation.ts}
├── tests/, e2e/, .storybook/
├── components.json (shadcn), next.config.ts, tsconfig.json, package.json, vitest.config.ts
```

## Steps

1. Scaffold with `pnpm create next-app@latest apps/web` — TS, App Router, Tailwind, src/. Set name `@rubik/web`.
2. Upgrade Tailwind to v4; replace config with `@theme` block in `globals.css`.
3. Initialize shadcn: `pnpm dlx shadcn@latest init`; add components incrementally as needed (Button, Input, Form, Table, Dialog, Tabs, Tooltip, Toaster, Command).
4. Add libraries from §19.1: `@tanstack/react-{query,query-devtools,table,virtual,react-pacer}`, `zustand`, `react-hook-form` + `@hookform/resolvers`, `next-auth@5`, `cmdk`, `sonner`, `lucide-react`, `react-markdown` + `remark-gfm` + `rehype-sanitize`, `dayjs`, `@sentry/nextjs`, workspace deps `@rubik/{shared,cube-core,visualizer}`.
5. Set up `lib/api-client.ts` (fetch wrapper, auth header, error mapping), `lib/env.ts` (zod-validated env), providers in `providers/`.
6. Implement Auth.js v5 with the Google provider; `signIn` callback POSTs ID token to `/v1/auth/google`; store api JWT in httpOnly cookie. `getCurrentUser()` server helper.
7. Build routes per §19.2: landing, `/3x3` puzzle hub, `/3x3/[method]`, `/3x3/[method]/[set]`, `/3x3/[method]/[set]/[case]`, `/timer`, `/search`, `/me/algorithms` (auth-gated), `/login`, `/embed/visualizer`.
8. Catalog pages are RSC + SSG with `revalidate = 600`. Set page renders SVG diagrams (RSC). Case page lazy-loads `<Visualizer/>` from `@rubik/visualizer/client`.
9. `/me/algorithms` uses TanStack Table + Virtual + TanStack Query; mutations through RHF + zod resolver.
10. Timer page: zustand store with `persist` middleware (localStorage of last N times); spacebar state machine (idle → inspecting → ready → solving → done).
11. Search: server component fetches `/v1/search`; ⌘K palette in the layout via `cmdk` debounced through `@tanstack/react-pacer`.
12. SEO: per-route `generateMetadata`, JSON-LD `HowTo` on case page, `app/sitemap.ts` from api `/v1/sitemap`, `app/robots.ts`, dynamic `opengraph-image.tsx` per case.
13. `instrumentation.ts` initializes Sentry server + client; pino server-side logger.
14. Storybook for `CubeVisualizer`, `CaseCard`, `SetGrid`, `data-table` wrapper.
15. Playwright e2e: `learn-flow`, `browse`, `timer`, embed iframe sizing.

## Done when

- [ ] `make dev.web` serves on `localhost:3000` against the live api on `:3001`.
- [ ] `pnpm --filter @rubik/web build` succeeds; bundle analyzer shows non-visualizer JS <200kb gzipped.
- [ ] Lighthouse on `/3x3/cfop/pll/t-perm`: LCP <2.5s, CLS <0.1, INP <200ms.
- [ ] Playwright e2e `learn-flow` passes against fixture content.
- [ ] Reduced-motion mode disables visualizer animation.
- [ ] `/embed/visualizer` works in an iframe with `postMessage` resize.

## Out of scope

- Public profiles, leaderboards, social — v2.
- Trainer mode (PLL/OLL drill) — v2.
- Solver UI — v2.
