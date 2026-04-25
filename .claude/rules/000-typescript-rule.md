# TypeScript Conventions

TypeScript 5 strict across the whole monorepo (web, api, docs, packages). Enforced by ESLint flat config and `tsc --noEmit`. Each rule has a **Why:** so judgment calls at the edges are straightforward.

## Strict mode

- **Strict is non-negotiable.** Root `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`, `forceConsistentCasingInFileNames`. Every package extends this base.
  - Why: api ships to a long-running Node process, web ships to browsers, packages run in both — the compiler is the only universal line of defense. Loosening once leaks everywhere.
- **`isolatedModules: true` everywhere.** A file must be compilable in isolation.
  - Why: required by Vite, esbuild, and SWC; dropping it breaks `apps/web` and `apps/docs` builds.

## Imports

- **Cross-workspace: import via package name** (`@rubik/shared`, `@rubik/cube-core`, `@rubik/visualizer`). Never reach across packages with relative paths.
  - Why: package boundaries are the architectural seams (§20.4). Relative cross-package imports defeat the dep graph and break Turborepo's caching.
- **Within a package: relative paths or a per-package `@/*` alias.** Each app/package decides; pick one and stick to it inside that workspace.
  - Why: there's no monorepo-wide `@/*` alias. Tooling (Next, Nest, Vite) already each have their own root concept.
- **Prefer `import type` for type-only imports.** ESLint (`@typescript-eslint/consistent-type-imports`) auto-fixes to inline form: `import { type Foo, bar } from "..."`.
  - Why: type-only imports get erased at build; mixing them with values can defeat tree-shaking and bloats the dev graph.
- **Imports are auto-sorted** by `eslint-plugin-simple-import-sort`. Don't hand-order.
  - Why: zero diff noise; reviewers focus on intent.

## Types vs interfaces

- **Default to `type`; reach for `interface` only when declaration merging is the point** (e.g., augmenting a third-party module via `declare module "..."`).
  - Why: `type` and `interface` are near-equivalent for object shapes; picking one kills the "which today?" debate. `interface`'s unique power is declaration merging — that's the legitimate use case.
- **No `T` / `I` prefix on type or interface names.** Write `User`, `CaseDto`, `CubeState`. Both use `UpperCamelCase`.
  - Why: Hungarian notation; the IDE shows the kind on hover. Callers shouldn't care whether `User` is a `type` or an `interface`.
- **Domain suffixes, not kind suffixes.** Use purpose suffixes that survive refactors:
  - `*Dto` — request/response shapes on the api boundary (`CaseDto`, `LoginDto`).
  - `*Schema` — zod schemas (`CaseSchema`).
  - `*Props` — React component props (`VisualizerProps`).
  - `*Options` — option bags for hooks/helpers (`PlaybackOptions`).
  - `*Result` / `*Response` — async return shapes when the noun is ambiguous.
  - Why: kind suffixes (`*Type`, `*Interface`) rot the moment the declaration changes; purpose suffixes stay correct.

## Type-level patterns

- **`readonly` + `as const` for static data.** Constant arrays/maps freeze at the type level: `export const PUZZLE_SLUGS = ['3x3'] as const`.
  - Why: surfaces mutation bugs at type-check time; gives literal-narrowed types for free.
- **Narrow with type guards, not casts.** Pattern: `isLearningStatus(x): x is LearningStatus`. Reject `as LearningStatus`.
  - Why: casts lie to the compiler; guards generate runtime checks the api can share with the proxy and seed code.
- **Use `satisfies` for values that must conform without widening.** `defaultStatus = "learning" satisfies LearningStatus`.
  - Why: `as LearningStatus` drops the literal; `satisfies` keeps `"learning"` addressable.
- **Name exported types; avoid anonymous inline object types on public surfaces.** Internal helpers can stay inline.
  - Why: named types appear in IDE tooltips and `.d.ts` output — the docs-by-hover layer.

## Schemas + types — single source of truth

- **All API DTOs are zod schemas in `packages/shared/schemas/`.** Types are derived: `export type Case = z.infer<typeof CaseSchema>`.
  - Why: schema drift between web and api is impossible by construction. The same zod literal validates input on the api and parses responses on the web.
- **Don't redeclare a DTO type — `z.infer` it.**
  - Why: hand-typed DTOs get out of sync with their schemas the moment one changes.

## Language features

- **Avoid enums; use `as const` unions** (`LearningStatus = typeof LEARNING_STATUSES[number]`).
  - Why: enums emit runtime objects, fight `isolatedModules`, and don't tree-shake in some setups.
- **Prefer discriminated unions over boolean props with unclear combos.** `{ kind: 'pll', state: ... } | { kind: 'oll', state: ... }`.
  - Why: makes invalid states unrepresentable.
- **Use early returns.** Don't nest `if` ladders when a guard suffices.
  - Why: flat code is easier to grep and reason about.

## Workspace `tsconfig` shape

- **Each workspace extends `../../tsconfig.json`.** Per-package overrides are limited to `compilerOptions.types`, `paths`, `outDir`, `rootDir`, and JSX settings.
  - Why: one strictness baseline. Per-package overrides for fundamentals (target, module, strict) defeat the whole point.
- **`apps/api` adds `"emitDecoratorMetadata": true, "experimentalDecorators": true`** for NestJS.
  - Why: NestJS DI relies on `reflect-metadata`; without these, modules don't wire up.
- **`apps/web` and `apps/docs` add `"jsx": "preserve"`** (Next.js / VitePress own JSX transform).
  - Why: framework's own bundler does the JSX, not tsc.
