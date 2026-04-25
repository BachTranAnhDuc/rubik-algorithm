# Plan 02 — `packages/shared`

**Depends on:** 01.
**Produces:** the DTO contract package consumed by both web and api.
**Reference:** §20.3, §22.3.

## Goal

Single source of truth for API request/response shapes, content-file shapes, and notation/constant helpers. Schemas defined once with zod; types inferred; both web and api import from here. No React, no Node-specific code.

## Deliverables

```
packages/shared/
├── package.json                       name: @rubik/shared, exports for ., /content
├── tsconfig.json                      extends root base
├── src/
│   ├── index.ts                       barrel
│   ├── schemas/
│   │   ├── puzzle.ts                  PuzzleSchema, MethodSchema, SetSchema, CaseSchema, VariantSchema
│   │   ├── user.ts                    UserSchema, UserAlgorithmSchema
│   │   ├── auth.ts                    GoogleLoginSchema, TokenPairSchema
│   │   ├── scramble.ts
│   │   ├── search.ts
│   │   ├── pagination.ts
│   │   ├── error.ts
│   │   ├── content.ts                 PuzzleContentSchema etc. (file-shape variants)
│   │   └── index.ts
│   ├── types/index.ts                 inferred TS types from schemas
│   ├── constants/{puzzles,methods,sets,learning-status}.ts  *_SLUGS as const
│   ├── notation/{format,normalize,tokens}.ts                display + canonicalization
│   └── utils/{slug,result,id}.ts
└── __tests__/
    ├── schemas.spec.ts
    ├── notation.spec.ts
    └── slug.spec.ts
```

## Steps

1. Scaffold the package via `pnpm init` inside `packages/shared`; set `"name": "@rubik/shared"` and the exports map.
2. Add `zod` (peer + direct dep), `@types/node` from root.
3. Write schemas in dependency order: pagination/error → user → puzzle → variant → case → set → method → search → scramble → content.
4. Re-export inferred types from `types/index.ts` (`export type Case = z.infer<typeof CaseSchema>`).
5. Add constants and notation helpers per §22.3.
6. Write unit tests for: zod parse/reject roundtrips, kebab-case slug regex, notation normalize/format.
7. Wire `lint`, `typecheck`, `test` scripts in `package.json`.

## Done when

- [ ] `@rubik/shared` resolves from a sibling workspace import.
- [ ] `pnpm --filter @rubik/shared typecheck` is clean.
- [ ] `pnpm --filter @rubik/shared test` passes (target ≥80% lines).
- [ ] `import { CaseSchema } from '@rubik/shared'` works; `CaseSchema.safeParse(...)` validates per §22.3 rules.
- [ ] `import { PuzzleContentSchema } from '@rubik/shared/content'` works (subpath export).

## Out of scope

- Any cube-state validation beyond shape — algorithm/cube-state correctness lives in `cube-core` (Plan 03).
- API endpoint logic — Plan 05.
