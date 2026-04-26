# rubik-algorithm

A fullstack platform for the speedcubing community. v1 ships the full 3x3 CFOP curriculum (cross, F2L, OLL, PLL) as a learnable, searchable, trackable algorithm corpus. The architecture extends to other puzzles and methods.

## Stack

- **Web** — Next.js 15 (App Router) + React 19 + Tailwind v4 + shadcn/ui
- **API** — NestJS 11 + Prisma + Postgres (Neon) + Redis (Upstash)
- **Docs** — VitePress
- **Packages** — `@rubik/cube-core` (puzzle logic + scrambler), `@rubik/visualizer` (SVG SSR + three.js client), `@rubik/shared` (zod schemas, types)
- **Content** — YAML in `content/`, ingested into Postgres by the seed pipeline
- **Tooling** — pnpm workspaces, Turborepo, Vitest, Playwright

## Repository layout

```
apps/{web,api,docs}
packages/{shared,cube-core,visualizer}
content/
docs/plans/
```

## Getting started

Prereqs: Node ≥ 24, pnpm ≥ 9, Docker (for local Postgres + Redis).

```bash
pnpm install
make services.up      # start Postgres + Redis
make db.migrate       # apply migrations
make db.seed          # load YAML content into the DB
make dev              # run web + api + docs concurrently
```

`make help` lists all available targets.

## Source of truth

- [`AGENTS.md`](AGENTS.md) — entry point for agents working in the repo (rules + design index).
- [`docs/plans/2026-04-25-rubik-platform-mvp-design.md`](docs/plans/2026-04-25-rubik-platform-mvp-design.md) — master design (23 sections covering scope, architecture, schema, content pipeline, and tooling).
- [`docs/plans/2026-04-25-implementation/`](docs/plans/2026-04-25-implementation/) — sequenced implementation plans (01 bootstrap → 09 deployment).
- [`.claude/rules/`](.claude/rules/) — coding conventions (TypeScript, React, NestJS, Prisma, monorepo, content, testing, process, code style, MCP).

## Contributing

Branches follow `plan-NN-<short>` for plan execution and `<type>/<scope>-<short>` otherwise. Commits are lowercase Conventional Commits (`feat(visualizer): …`). See [`.claude/rules/080-process-rule.md`](.claude/rules/080-process-rule.md).
