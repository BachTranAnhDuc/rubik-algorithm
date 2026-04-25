# Plan 08 — `apps/docs`

**Depends on:** 01.
**Produces:** the VitePress documentation site — static, deployable to Cloudflare Pages.
**Reference:** §17.

## Goal

Documentation that ships alongside code: architecture, API reference (auto-rendered from OpenAPI), dev setup, ops runbooks, ADRs. PRs that change behavior also update relevant pages.

## Deliverables

```
apps/docs/
├── .vitepress/
│   ├── config.ts                       nav, sidebar, theme, search, mermaid, head
│   └── theme/                          empty in v1
├── index.md
├── guide/{getting-started,monorepo-layout,local-dev,content-authoring}.md
├── architecture/{overview,domain-model,frontend,backend,database,visualizer,auth}.md
├── api/{overview,reference}.md         reference auto-generated
├── ops/{deployment,runbook,observability}.md
├── contributing/{conventions,testing,commit-style}.md
├── decisions/adr-0001-nestjs-over-fastify.md
├── package.json                        name: @rubik/docs
└── tsconfig.json
```

## Steps

1. Scaffold inside `apps/docs`. Add `vitepress`, `vue` (transitive), `vitepress-plugin-mermaid`, `mermaid` as dev deps.
2. Configure `.vitepress/config.ts`: nav, sidebar generated from directory structure or hand-written, Mermaid plugin, custom-domain head meta, sitemap.
3. Set up the API-reference build script: a small `scripts/gen-api-reference.ts` that reads `apps/api/openapi.json` (emitted by Plan 05) and writes `apps/docs/api/reference.md`. Wire it as `pnpm --filter @rubik/docs gen:api`. CI runs `gen:api` before `build`.
4. Author pages: port the relevant sections of the design doc — but **summarize and link**, don't paste verbatim. Architecture pages should be concise overviews; the design doc remains the source of truth for now.
5. Author ADR-0001 (NestJS over Fastify) using the §18 rationale as the source.
6. Verify `pnpm --filter @rubik/docs dev` starts a local server with hot reload.
7. Verify `pnpm --filter @rubik/docs build` produces static output in `apps/docs/.vitepress/dist`.

## Done when

- [ ] `make dev.docs` runs the docs site locally with HMR.
- [ ] `make docs.build` produces a clean static site (<60s build).
- [ ] Built-in Minisearch search returns results across all pages.
- [ ] Mermaid diagrams render in fenced code blocks.
- [ ] `apps/docs/api/reference.md` regenerates from the latest OpenAPI spec.
- [ ] Internal links validate (no broken links).

## Out of scope

- Custom theme — defer until content stabilizes.
- Versioned docs (per-release branches) — v1 has one version.
- Translations — v1 is English.
