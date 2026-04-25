# Plan 03 — `packages/cube-core`

**Depends on:** 01.
**Produces:** pure 3x3 puzzle logic — the correctness heart of the system.
**Reference:** §20.1.

## Goal

A dependency-free TypeScript library that any consumer (api, visualizer, future solver) can use to: parse moves, apply moves, recognize cases, scramble. Designed so v2 puzzles plug in via the same `Puzzle<TState, TMove>` interface.

## Deliverables

```
packages/cube-core/
├── package.json                       name: @rubik/cube-core, no workspace deps
├── tsconfig.json
├── src/
│   ├── index.ts                       barrel
│   ├── types.ts                       Move, Face, Algorithm, State
│   ├── puzzle/{puzzle.interface.ts, puzzle-3x3.ts, puzzle-3x3.spec.ts}
│   ├── moves/{parser,moves-3x3,perm,apply,inverse,mirror,cancel}.ts (+ specs)
│   ├── algorithm/{operations,metrics,normalize}.ts (+ specs)
│   ├── state/sticker-model.ts (+ spec)
│   ├── recognition/{pll,oll,f2l,normalize}.ts (+ specs)
│   ├── scramble/{wca-3x3,case-scramble,rng,known-scrambles}.ts (+ specs)
│   └── property/{arbitraries.ts, inverse.spec.ts, mirror.spec.ts, canonicalization.spec.ts, recognition.spec.ts}
└── fixtures/
    └── known-scrambles.json           ~20 scrambles + states + canonical solutions
```

PLL/OLL/F2L canonical fingerprints live inline as exports (`PLL_CANONICAL_STATES`, `OLL_CANONICAL_STATES`, `F2L_CANONICAL_STATES`), not separate JSON fixtures. State concerns (piece-model, conversion, solved, equality, hash) consolidated into `sticker-model.ts`. Tokenizer absorbed into `parser.ts` (single-pass tokenize + parse).

## Steps

1. Scaffold package; add `vitest`, `@vitest/coverage-v8`, and `fast-check` as devDeps.
2. Implement sticker model + helpers (`SOLVED_STATE`, `isSolved`, `stateEquals`, `hashState`, `fromStickerString`, `toStickerString`); verify with hand-computed solved states.
3. Implement move parser for full WCA notation (faces, primes, doubles, wides, slices, rotations) — tokenize + parse in one pass.
4. Implement `apply.ts` (string-state representation; `perm.ts` carries per-move sticker permutations). Move definitions in `moves-3x3.ts` (which axis, which angle, wide/slice/rotation flag).
5. Implement algorithm operations: inverse, mirror (M/S/E), conjugate, commutator, cancel, normalize.
6. Implement recognition for PLL (21), OLL (57), F2L (41) with AUF/y-rotation normalization.
7. Implement WCA scrambler (random with no consecutive same-face/axis), seedable for tests; case-scramble (state + inverse-of-solution).
8. Author `fixtures/known-scrambles.json` with at least 20 entries; add regression test that loads each and verifies state.
9. Add property-based tests: `apply(seq) ∘ apply(inverse(seq)) = identity`, `mirror(mirror(seq)) = seq`, `cancel(normalize(x)) = cancel(x)`, recognition round-trip.
10. Add `Puzzle<TState, TMove>` interface and `Puzzle3x3` const composing flat exports — the v2 extensibility seam called for by §20.1. Test the wiring by round-tripping through the interface only.

## Done when

- [x] `pnpm --filter @rubik/cube-core typecheck` clean.
- [x] Coverage ≥95% lines (locked in §11). Currently 99.09%.
- [x] All property tests pass with default 100 runs.
- [x] All 21 PLLs and 57 OLLs round-trip: scramble into case → recognize → matches.
- [x] Public API matches §20.1 export list.
- [x] `Puzzle3x3` exported and round-trips a state through the interface only.

## Out of scope

- Any 3D rendering — Plan 04 (visualizer).
- Solver (Kociemba) — deferred to v2 per §13.
- Other puzzles — interface ready, implementations deferred.
