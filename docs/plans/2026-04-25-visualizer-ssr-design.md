# Plan 04a — visualizer SSR ship-it

**Plan:** [`04-packages-visualizer.md`](2026-04-25-implementation/04-packages-visualizer.md). Sub-phase 04a; 04b (3D client) deferred.
**Master design refs:** §20.2 (visualizer architecture), §050 (monorepo + split exports), §020 (sticker color tokens).
**Predecessors:** plan 01 (bootstrap), plan 03 (cube-core).
**Branch:** `plan-04a-visualizer-ssr`.

## Problem & goal

`packages/visualizer/` was scaffolded locally during an earlier session — full SVG path implemented (TopView, PLLView, OLLView, F2LView, stickerLayout, color tokens, package.json with split exports `.`/`./ssr`/`./client`) — but never committed. The work has been showing up as untracked the entire time. 19 unit tests pass, typecheck and lint are clean.

This sub-phase ships the SVG/SSR path of plan 04 to main: commit the existing work, update plan 04's "Done when" to split SSR/3D, and defer the 3D client to a dedicated 04b sub-phase that will land when plan 07's case page actually wants to embed it.

## Decisions (from brainstorm)

1. **04a then 04b decomposition.** Ship SSR-only now (low risk, immediately useful for plan 07 catalog grid + RSC pages); defer the full 3D path (three.js scene + R3F + animation + Storybook + a11y) to 04b when plan 07 needs it on the case page.
2. **No code changes in 04a.** The local SSR work is structurally sound. Just commit + plan-doc update.
3. **`client.ts` continues to re-export `./ssr`** until 04b. The existing inline comment already documents this as deferred — keep the comment.

## Architecture (as-is, ships verbatim)

```
packages/visualizer/
├── package.json              split exports . / ./ssr / ./client
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
└── src/
    ├── index.ts              re-exports ./ssr (default safe surface)
    ├── ssr.ts                SVG views + sticker layout + color tokens
    ├── client.ts             today: re-exports ./ssr; future: lazy 3D
    ├── tokens/colors.ts      WCA 3x3 palette + colorForSticker helper
    └── svg/
        ├── stickerLayout.ts        coord math for the 5×5 + slot-pair views
        ├── stickerLayout.spec.ts   11 tests
        ├── TopView.tsx             U face + 4 side strips, 5×5 grid
        ├── PLLView.tsx             thin wrapper styled for PLL chart
        ├── OLLView.tsx             thin wrapper styled for OLL chart
        ├── F2LView.tsx             slot-pair perspective view
        └── views.spec.tsx          8 tests covering all four views
```

All views accept a 54-char `state: string` (cube-core's `toStickerString` format), plus optional sizing/styling props. They're pure React function components — no hooks, no client state — so they're zero-hydration-cost in a Next.js Server Component.

## Verification

```bash
pnpm --filter @rubik/visualizer test       # → 19 tests pass
pnpm --filter @rubik/visualizer typecheck  # → clean
pnpm --filter @rubik/visualizer lint       # → clean
pnpm --filter @rubik/visualizer build      # → dist/ with index.js, ssr.js, client.js + .d.ts
```

Importability smoke from another workspace (drop a temp .ts in `apps/api/` and run via tsx):

```ts
import { PLLView } from '@rubik/visualizer/ssr'
console.log(typeof PLLView)  // 'function'
```

## Commit plan

Two commits on `plan-04a-visualizer-ssr`:

1. **`feat(visualizer): scaffold package with svg views per plan 04a`**
   Adds the entire `packages/visualizer/` directory (already structurally complete locally). Body explains SSR-only scope and forward-points to 04b for 3D.

2. **`docs(plans): split plan 04 done-when into 04a/04b`**
   Updates `docs/plans/2026-04-25-implementation/04-packages-visualizer.md`:
   - Sub-phase 04a "Done when" — checked items reflecting the SSR ship.
   - Sub-phase 04b "Done when" — unchecked items for 3D + Storybook + animation + reduced-motion.
   - "Out of scope this sub-phase" note pointing 3D to 04b.

(This design doc itself is committed as a third commit `docs(plans): add visualizer ssr design for plan 04a`, identical to the sub-phase 4 / plan 06 / sub-phase 5a precedent.)

## Done when

- [ ] `packages/visualizer/` directory committed to main (no longer in untracked working tree)
- [ ] `import { PLLView } from '@rubik/visualizer/ssr'` resolves cleanly from another workspace
- [ ] `pnpm typecheck && pnpm lint && pnpm test` clean across the visualizer package
- [ ] Plan 04 doc reflects the 04a/04b split with appropriate done-when items
- [ ] Commits follow lowercase Conventional Commits with scope `visualizer` / `plans`

## Out of scope (deferred to 04b)

- `src/three/{createCubeScene,animation,materials,tween}.ts` — framework-agnostic three.js scene
- `src/react/{Visualizer,Cube,Cubie}.tsx`, `src/react/camera/CameraRig.tsx`, `src/react/hooks/{usePlayback,useMoveAnimation}.ts` — R3F React layer + playback state machine (zustand)
- `stories/{Visualizer,views}.stories.tsx` — Storybook scaffolding (Storybook isn't even installed in the repo yet; 04b adds it)
- `__tests__/animation.spec.ts` — pure-logic animation tests (float-drift mitigation, RAF tween correctness)
- Three.js as a real workspace dep — stays as optional peer dep until 04b's React + R3F integration
- Reduced-motion accessibility on the 3D viewer
- Keyboard + ARIA on the 3D viewer

When 04b lands, web's case page (plan 07) will use `next/dynamic({ ssr: false })` to lazy-load `@rubik/visualizer/client`. Until then `client.ts` re-exporting SSR keeps imports stable for any downstream that prematurely imports from `./client`.

## Forward-compat notes

- The split-exports topology (`.`/`./ssr`/`./client`) is stable; 04b just changes what `./client` exports without touching `./ssr` consumers.
- The color tokens at `tokens/colors.ts` are the single source of truth (per `020-styling-rule.md`); 04b's three.js materials will read from this same module.
- Sticker-layout coord math in `svg/stickerLayout.ts` is purely 2D — 04b's 3D scene reuses sticker character → color but builds its own cubie geometry from scratch.
