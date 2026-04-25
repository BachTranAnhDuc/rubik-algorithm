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
│   ├── puzzle/{puzzle.interface.ts, puzzle-3x3.ts}
│   ├── moves/{tokenizer,parser,moves-3x3,apply,inverse,mirror,cancel}.ts
│   ├── algorithm/{operations,metrics,normalize}.ts
│   ├── state/{piece-model,sticker-model,conversion,solved,equality,hash}.ts
│   ├── recognition/{pll,oll,f2l,normalize}.ts
│   └── scramble/{wca-3x3,case-scramble,rng}.ts
├── fixtures/
│   ├── known-scrambles.json           ~20 scrambles + states + canonical solutions
│   ├── pll-cases.json                 21 case-state fingerprints
│   └── oll-cases.json                 57 case-state fingerprints
└── __tests__/
    ├── apply.spec.ts
    ├── inverse.spec.ts
    ├── mirror.spec.ts
    ├── recognition.spec.ts
    ├── scramble.spec.ts
    └── property/
        ├── inverse.property.ts
        ├── mirror.property.ts
        └── canonicalization.property.ts
```

## Steps

1. Scaffold package; add `vitest` and `fast-check` as devDeps.
2. Implement piece + sticker models and conversions; verify with hand-computed solved states.
3. Implement move parser/tokenizer for full WCA notation (faces, primes, doubles, wides, slices, rotations).
4. Implement `apply.ts` allocation-free in hot paths (typed arrays). Move definitions in `moves-3x3.ts` (which cubies, which axis, which angle).
5. Implement algorithm operations: inverse, mirror (M/S/E), conjugate, commutator, cancel, normalize.
6. Implement recognition for PLL (21), OLL (57), F2L (41) with AUF/rotation normalization.
7. Implement WCA scrambler (random with no consecutive same-face/axis), seedable for tests; case-scramble (state + inverse-of-solution).
8. Author `fixtures/known-scrambles.json` with at least 20 entries; add regression test that loads each and verifies state.
9. Add property-based tests: `apply(seq) ∘ apply(inverse(seq)) = identity`, `mirror(mirror(seq)) = seq`, `cancel(normalize(x)) = cancel(x)`.

## Done when

- [ ] `pnpm --filter @rubik/cube-core typecheck` clean.
- [ ] Coverage ≥95% lines (locked in §11).
- [ ] All property tests pass with default 100 runs.
- [ ] All 21 PLLs and 57 OLLs round-trip: scramble into case → recognize → matches.
- [ ] Public API matches §20.1 export list.

## Out of scope

- Any 3D rendering — Plan 04 (visualizer).
- Solver (Kociemba) — deferred to v2 per §13.
- Other puzzles — interface ready, implementations deferred.
