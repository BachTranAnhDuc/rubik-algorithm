# Monorepo Conventions

pnpm workspaces + Turborepo. Three apps (`web`, `api`, `docs`), three packages (`shared`, `cube-core`, `visualizer`), one content directory.

## Workspace topology

- **Three apps, three packages, one content dir.** Per §3:
  ```
  apps/{web,api,docs}
  packages/{shared,cube-core,visualizer}
  content/
  ```
  - Why: matches the design. Adding a fourth app means revisiting the architecture, not just dropping a folder.
- **Don't introduce a new package without 3+ consumers** or a clear separation of concern (e.g., split a leaf when it grows past one purpose).
  - Why: package count grows linearly, build complexity grows quadratically (cross-package versioning, cross-cutting refactors). Most "extract a package" instincts are premature.

## Package naming

- **All workspaces use the `@rubik/<name>` namespace.** `@rubik/web`, `@rubik/api`, `@rubik/docs`, `@rubik/shared`, `@rubik/cube-core`, `@rubik/visualizer`.
  - Why: `pnpm --filter @rubik/api` is unambiguous; bare names collide with public npm packages.
- **The package name is the import name.** `import { CaseSchema } from '@rubik/shared'` works because `packages/shared/package.json` is `"name": "@rubik/shared"`.
  - Why: pnpm workspace resolution maps name → package; no separate alias scheme to maintain.

## Dependency direction

- **Leaves first.** `shared` and `cube-core` depend on no workspace packages. `visualizer` depends on `cube-core`. Apps consume what they need (§20.4).
  - Why: keeps build order linear, prevents cycles at the architectural level.
- **`apps/api` never imports `@rubik/visualizer`.** Server has no need to render.
  - Why: pulling three.js into the api Docker image bloats it for nothing.
- **`apps/docs` imports nothing from `apps/*` or `packages/*` at runtime.** Build-time scripts can read `apps/api/openapi.json` to generate the API reference page.
  - Why: docs is a static site; runtime cross-app deps would couple deploys.
- **Cross-package imports use the package name, never relative paths.** `@rubik/cube-core/state`, not `../../packages/cube-core/src/state`.
  - Why: relative cross-package imports defeat Turborepo's dep graph and break when a package moves.

## Each package's `package.json`

- **`exports` field declares the public surface.** Subpath exports (`./ssr`, `./client`) when a package legitimately ships multiple entry points (visualizer).
  - Why: bare `main`/`module` is the legacy path; `exports` enforces what's importable and lets bundlers tree-shake correctly.
- **`type: "module"` everywhere.** ESM is the format.
  - Why: matches Node 22, Vite, and modern tooling. CJS shims are dead weight.
- **`peerDependencies` for things the consumer must provide** (e.g., `react`, `three` in `visualizer`). `dependencies` for things the package controls.
  - Why: prevents duplicate React in `apps/web` (one from web, one from visualizer); peer deps share a single version.
- **`scripts: { build, dev, lint, typecheck, test }` in every package** with consistent names.
  - Why: Turborepo's task graph keys on script names. Drift breaks `turbo run build`.

## Each package's `tsconfig.json`

- **Extends `../../tsconfig.json`** with only the per-package overrides it actually needs (`outDir`, `rootDir`, `paths`, JSX, decorators).
  - Why: one strictness baseline (§000). Override the minimum.
- **No project references in v1.** `composite: true` and `references` add complexity for marginal benefit at this scale.
  - Why: Turborepo already gives us cache-aware incremental builds; project references would duplicate that without solving a current problem.

## Turborepo

- **Pipelines: `build`, `dev`, `lint`, `typecheck`, `test`.** Each declares `dependsOn` and `outputs` in `turbo.json`.
  - Why: explicit dependencies enable correct caching; explicit outputs let Turbo skip work and remote-cache it later.
- **`dev` is `cache: false, persistent: true`.** Don't cache long-running dev servers.
  - Why: caching a watch-mode process is undefined behavior.
- **`build` outputs include `dist/**`, `.next/**` (with `!.next/cache/**`), `.vitepress/dist/**`.** Each package contributes its own.
  - Why: Turbo restores these from cache on hit; missing entries cause "build succeeded but no output" surprises.
- **Filter with `pnpm --filter @rubik/<name>` for single-package runs.** Make targets wrap the common ones (`make dev.api`).
  - Why: explicit filters beat the default `-r` for single-package iteration.

## Versioning and lockfile

- **One `pnpm-lock.yaml` at the root.** Don't generate per-package lockfiles.
  - Why: workspaces share the lockfile; per-package lockfiles defeat the workspace.
- **No `npm`/`yarn` artifacts.** No `package-lock.json`, no `yarn.lock`.
  - Why: mixing lockfiles causes install drift; CI pins to pnpm.
- **Bump versions in all-or-nothing batches.** When upgrading a major framework (Next, NestJS, Prisma), bump it across every consumer in one PR.
  - Why: partial upgrades create dual-versioned graphs that explode at the next install.

## Adding a new workspace

When a new app or package is justified, the steps are:

1. Create `apps/<name>/` or `packages/<name>/`.
2. `package.json` with `"name": "@rubik/<name>"`, `type: "module"`, `engines.node: ">=22"`, scripts mirroring the existing pattern.
3. `tsconfig.json` extending `../../tsconfig.json`.
4. Add the workspace to `pnpm-workspace.yaml` (already covers `apps/*` and `packages/*` — this is automatic).
5. `pnpm install` from the root regenerates the lockfile.
6. If it's a package: define `exports` and write at least one barrel test that imports from the package name.
7. Update the relevant Make targets (`dev.<name>`, etc.) and design doc § (Architecture overview).

- Why: every workspace addition touches the same five surfaces. A checklist beats forgetting one.
