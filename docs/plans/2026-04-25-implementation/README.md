# Implementation plans

Sequenced work breakdown for the Rubik platform. Each plan is a self-contained, agent-executable unit. Run them in numeric order.

The architectural reference is the master design at [`../2026-04-25-rubik-platform-mvp-design.md`](../2026-04-25-rubik-platform-mvp-design.md). Plans cite section numbers (§N.M) where helpful but do not duplicate design content.

## Build order

| # | Plan | What it produces | Depends on |
|---|---|---|---|
| 01 | [Bootstrap monorepo](./01-bootstrap-monorepo.md) | Workspace shell: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, base `tsconfig.json`, lint/format/git config | — |
| 02 | [`packages/shared`](./02-packages-shared.md) | zod DTO schemas, types, constants, notation helpers | 01 |
| 03 | [`packages/cube-core`](./03-packages-cube-core.md) | Puzzle model, move algebra, recognition, scrambler | 01 |
| 04 | [`packages/visualizer`](./04-packages-visualizer.md) | three.js + SVG cube rendering, split `/ssr` and `/client` exports | 01, 03 |
| 05 | [`apps/api`](./05-apps-api.md) | NestJS api: modules, auth, Prisma, OpenAPI emit | 01, 02, 03 |
| 06 | [Initial content](./06-initial-content.md) | `content/` YAML for puzzle/method/sets + fixtures + sample cases | 02, 03, 05 |
| 07 | [`apps/web`](./07-apps-web.md) | Next.js 15 App Router, shadcn UI, TanStack, auth, visualizer integration | 01, 02, 03, 04, 05 |
| 08 | [`apps/docs`](./08-apps-docs.md) | VitePress site with project documentation | 01 |
| 09 | [Deployment](./09-deployment.md) | GitHub Actions CI/CD, Vercel, Fly.io, Cloudflare Pages, secrets | 05, 07, 08 |

Each plan ends with a **Done when** checklist — concrete acceptance criteria for marking the phase complete.

## Conventions

- Each plan stays focused on a single deliverable boundary. If scope grows, split into a sub-plan rather than expanding inline.
- All `pnpm` package names use the `@rubik/<name>` namespace.
- Default branch is `main`. Feature branches per plan are recommended (`plan-01-bootstrap`, `plan-02-shared`, …).
- Cite design sections (`§18.4`, `§21.3`) instead of restating decisions; the design doc is the source of truth.
