# Plan 04 — `packages/visualizer`

**Depends on:** 01, 03.
**Produces:** the 2D + 3D cube renderer, with split exports so RSC pages get SVG only and case pages lazy-load three.js.
**Reference:** §20.2.

## Goal

A consumer can do `import { PLLView } from '@rubik/visualizer/ssr'` from a Next.js Server Component (zero hydration cost) AND `import { Visualizer } from '@rubik/visualizer/client'` lazily on the case page (full 3D playback).

## Deliverables

```
packages/visualizer/
├── package.json                       exports: ".", "./ssr", "./client"
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── ssr.ts                         re-exports SVG only — RSC-safe
│   ├── client.ts                      re-exports React + three.js
│   ├── react/
│   │   ├── Visualizer.tsx
│   │   ├── Cube.tsx
│   │   ├── Cubie.tsx
│   │   ├── camera/CameraRig.tsx
│   │   └── hooks/{usePlayback,useMoveAnimation}.ts
│   ├── three/{createCubeScene,animation,materials,tween}.ts
│   ├── svg/{TopView,F2LView,OLLView,PLLView,stickerLayout}.tsx
│   └── tokens/colors.ts
├── stories/
│   ├── Visualizer.stories.tsx
│   └── views.stories.tsx
└── __tests__/
    ├── animation.spec.ts              pure logic, no DOM
    └── stickerLayout.spec.ts
```

## Steps

1. Scaffold; deps: `three`, `@react-three/fiber@^9`, `@react-three/drei`, `@rubik/cube-core` (workspace).
2. Author SVG views first (cheapest, works in RSC). Test sticker-coord math.
3. Build the framework-agnostic three.js scene in `three/` — no React. One scene per Visualizer.
4. Build the React layer wrapping the scene (R3F).
5. Implement the move animation: pluck 9 cubies into a transient `AnimationGroup`, RAF-tween rotation, snap onto local cubie positions, re-parent. Avoid float drift.
6. Build playback state machine in `usePlayback.ts` (zustand store local to the hook).
7. Wire keyboard + ARIA + `prefers-reduced-motion` per §20.2.
8. Add Storybook stories for both SVG and 3D variants.

## Done when

- [ ] `import { PLLView } from '@rubik/visualizer/ssr'` renders pure SVG with no client JS.
- [ ] `import { Visualizer } from '@rubik/visualizer/client'` lazy-loads three.js (chunk size ~200kb gzipped).
- [ ] Storybook builds; visual snapshots stable for canonical states.
- [ ] Long sequences (100+ moves) maintain visual correctness — no float drift.
- [ ] Reduced-motion mode disables animation and shows static end-state.

## Out of scope

- Embedding into the web app — Plan 07.
- Other puzzles — geometry is 3x3-specific in v1.
