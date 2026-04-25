# Plan 01 — Bootstrap monorepo

**Depends on:** —
**Produces:** workspace shell (no apps or packages yet).
**Reference:** §3, §16, §23.

## Goal

A clean, install-able pnpm + Turborepo monorepo. After this plan, `pnpm install` succeeds and `pnpm typecheck` / `pnpm lint` / `pnpm test` are valid no-ops (no workspaces yet to operate on).

## Deliverables

Repo-root files:

- `package.json` — root, private, `engines.node ≥ 24`, scripts proxying to turbo, devDeps for turbo + typescript + prettier + eslint + `@types/node`.
- `pnpm-workspace.yaml` — `apps/*` and `packages/*`.
- `turbo.json` — pipelines for `build`, `dev`, `lint`, `typecheck`, `test`.
- `tsconfig.json` — base config (strict, ES2022, bundler resolution, all `noUncheckedIndexedAccess` etc.).
- `.gitignore` — node_modules, dist, build artifacts, env files (with `!.env.example`).
- `.editorconfig` — 2-space, LF, trim trailing whitespace; tab indent for `Makefile`.
- `.prettierrc`, `.prettierignore` — repo formatting rules.
- `.nvmrc` — `22`.
- `eslint.config.js` — flat config, minimal recommended rules, ignores.
- `.env.example` — variable surface for local dev (DB, Redis, OAuth, JWT secrets).
- `.vscode/extensions.json` — recommended IDE extensions.

`Makefile`, `docker-compose.yaml`, `.dockerignore` already exist (§23) — verify they coexist cleanly.

## Steps

1. Write the files above.
2. Run `pnpm install`. Verify it generates `pnpm-lock.yaml` cleanly.
3. Run `pnpm turbo run typecheck` — should report "no tasks", not error.
4. Run `make services.up && make services.down` to confirm Compose still works.
5. Commit on a `plan-01-bootstrap` branch; merge after review.

## Done when

- [ ] `pnpm install` produces a deterministic `pnpm-lock.yaml`.
- [ ] `pnpm turbo run build` exits 0 with no work to do.
- [ ] `make help` lists targets correctly.
- [ ] `make services.up` brings up Postgres + Redis; `make services.down` tears them down.
- [ ] No directories under `apps/` or `packages/` yet.

## Out of scope

- Anything inside `apps/` or `packages/` — those land in plans 02–08.
- Any agent-specific rules (`CLAUDE.md`, `.cursorrules`, etc.) — added by the user after this plan.
