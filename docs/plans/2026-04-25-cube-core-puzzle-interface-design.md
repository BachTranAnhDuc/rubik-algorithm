# Cube-Core `Puzzle<TState, TMove>` Interface

A small design that closes plan 03 by adding the abstract puzzle seam called for by §20.1, and aligns the master design + plan 03 with the shape `cube-core` actually shipped. Everything else in plan 03 (notation, apply, algebra, recognition, scramble, property tests, fixtures) is already done — typecheck clean, 484 tests passing, coverage 99.07%.

## 1. Goal and non-goals

### 1.1 Goal

Add the abstract `Puzzle<TState, TMove>` interface and a concrete `Puzzle3x3` so future puzzles (4x4, Megaminx, Pyraminx) can plug into the api/visualizer/solver without consumer changes — the only architecturally meaningful gap left in plan 03.

### 1.2 Non-goals

- Refactoring existing flat exports. `applyMove`, `parseAlgorithm`, `recognizePll`, etc. stay where they are; `Puzzle3x3` composes them.
- Implementing additional puzzles. v1 ships 3x3 only.
- Renaming exports to match §20.1's draft list (`recognizePLL` → `recognizePll`, `scrambleWCA` → `wcaScramble`, etc.). The current names are kept; §20.1 is updated to reflect them.
- Splitting `state/sticker-model.ts` into the 5-file shape §20.1 sketches. The single file works; §20.1 is updated to reflect that.
- Adding `fixtures/{pll,oll}-cases.json`. The canonical fingerprints already live inline as `PLL_CANONICAL_STATES` / `OLL_CANONICAL_STATES`; redundant JSON files are not added.

### 1.3 Method

Compose-over-rewrite. The interface is a contract; the implementation wires existing flat exports into a const object. The seam is testable in isolation. The doc updates record the divergence between §20.1's first draft and the delivered shape.

---

## 2. Scope of what belongs on the interface

The interface holds **what every consumer needs that's puzzle-shape-independent** and excludes **what's intrinsically puzzle-specific**.

### 2.1 Included

- **Identity** — `id`, `displayName`, `solved` state.
- **Notation** — `parseAlgorithm`, `formatAlgorithm`, `formatMove`. Every puzzle has its own notation; consumers just round-trip strings.
- **Apply + algebra** — `applyMove`, `applyAlgorithm`, `invertMove`, `invertAlgorithm`. The `*Algorithm` variants stay first-class (not default-implemented from `*Move`) because cube-core has efficient typed-array implementations to keep.
- **State ops** — `isSolved`, `stateEquals`, `hashState`, `fromStickerString`, `toStickerString`. Sticker-string is the wire format and visualizer feed; every puzzle that has stickers needs this seam.
- **Scramble** — `scramble(options?: { length?, random? })`. Every puzzle needs one; rules differ per puzzle but each puzzle owns its own logic.

### 2.2 Excluded

- **Recognition.** PLL/OLL/F2L are 3x3-specific; they don't translate to Megaminx. Stays as flat top-level exports.
- **Metrics.** HTM/STM/ETM are 3x3 conventions; if 4x4 needs a different metric set, model it then.
- **Mirror.** M/S/E mirror axes are 3x3-class only. Stays as a flat 3x3-specific export (`mirrorAlgorithm`).

---

## 3. Interface shape

```ts
// packages/cube-core/src/puzzle/puzzle.interface.ts
import type { Random } from '../scramble/rng'

export interface Puzzle<TState, TMove> {
  readonly id: string
  readonly displayName: string
  readonly solved: TState

  parseAlgorithm: (input: string) => TMove[]
  formatAlgorithm: (moves: readonly TMove[]) => string
  formatMove: (move: TMove) => string

  applyMove: (state: TState, move: TMove) => TState
  applyAlgorithm: (state: TState, moves: readonly TMove[]) => TState

  invertMove: (move: TMove) => TMove
  invertAlgorithm: (moves: readonly TMove[]) => TMove[]

  isSolved: (state: TState) => boolean
  stateEquals: (a: TState, b: TState) => boolean
  hashState: (state: TState) => string

  fromStickerString: (str: string) => TState
  toStickerString: (state: TState) => string

  scramble: (options?: { length?: number; random?: Random }) => TMove[]
}
```

### 3.1 Deliberate calls

- **`readonly` arrays on input.** Wider type for callers; `Move[]` and `readonly Move[]` both flow in. Outputs stay mutable so caller chains work without `as` casts.
- **Method properties (`f: (...) => T`), not method shorthand (`f(...): T`).** Method shorthand is bivariant in TS; property form is correctly contravariant in arguments. Matters for variance when consumers pass a stricter `Puzzle<NarrowState, NarrowMove>` where a wider one is expected. Aligns with `000-typescript-rule.md`'s strictness baseline.
- **`hashState` returns `string`, not `number`.** A string hash of a typed-array state is collision-free for the 3x3 state space (~4×10¹⁹ states); a numeric (32/53-bit) hash would risk collisions across that space. The `hashState` consumer is map keys and equality fingerprints — string is the right type for both.
- **No mirror.** See §2.2.
- **Scramble lives on the puzzle, not as a generic `scrambleWCA(puzzle)` helper.** The WCA rules (no consecutive same-face, no axis-repeat-of-three) are 3x3-specific anyway; generalizing the helper would invent a constraint vocabulary nobody needs yet.

---

## 4. Concrete implementation

```ts
// packages/cube-core/src/puzzle/puzzle-3x3.ts
import { applyMove, applyAlgorithm } from '../moves/apply'
import { parseAlgorithm, formatMove, formatAlgorithm } from '../moves/parser'
import { invertMove } from '../moves/inverse'
import { invertAlgorithm } from '../algorithm/operations'
import {
  SOLVED_STATE,
  isSolved,
  stateEquals,
  hashState,
  fromStickerString,
  toStickerString,
} from '../state/sticker-model'
import { wcaScramble } from '../scramble/wca-3x3'
import type { Move, State } from '../types'
import type { Puzzle } from './puzzle.interface'

export const Puzzle3x3: Puzzle<State, Move> = {
  id: '3x3',
  displayName: '3x3 Cube',
  solved: SOLVED_STATE,
  parseAlgorithm,
  formatMove,
  formatAlgorithm,
  applyMove,
  applyAlgorithm,
  invertMove,
  invertAlgorithm,
  isSolved,
  stateEquals,
  hashState,
  fromStickerString,
  toStickerString,
  scramble: wcaScramble,
}
```

Pure composition — zero new logic. A const object, not a class, per `090-code-style-rule.md` ("arrow functions everywhere, NestJS classes excepted"). `wcaScramble`'s signature already matches `(options?) => Move[]`.

### 4.1 Public API additions

`packages/cube-core/src/index.ts` re-exports:

```ts
export type { Puzzle } from './puzzle/puzzle.interface'
export { Puzzle3x3 } from './puzzle/puzzle-3x3'
```

No removals or renames.

---

## 5. Tests

`packages/cube-core/src/puzzle/puzzle-3x3.spec.ts`:

- **Identity wiring.** `Puzzle3x3.id === '3x3'`, `displayName === '3x3 Cube'`, `solved === SOLVED_STATE`.
- **Notation round-trip via the interface only** (no flat-imports inside the test). Parse `"R U R' U'"`, apply, format back. Locks the contract — if any flat export is renamed, the wiring breaks loudly.
- **Apply parity.** `Puzzle3x3.applyAlgorithm(solved, parse("R U R' U'") × 6) === solved` (the sexy-move identity).
- **Invert parity.** `applyAlgorithm(state, moves) → applyAlgorithm(_, invertAlgorithm(moves)) === state`.
- **Sticker round-trip.** `toStickerString(fromStickerString(s)) === s` for the solved state and one scrambled state.
- **Scramble shape.** `Puzzle3x3.scramble({ length: 25 }).length === 25`; with a seeded `Random`, output is deterministic.

Coverage gate stays ≥95%; new files add a small test file alongside, expected to land at 100% (pure composition is straightforward to cover).

---

## 6. Doc updates

### 6.1 `docs/plans/2026-04-25-rubik-platform-mvp-design.md` §20.1

Two patches:

**Folder-structure block** — drop entries that don't reflect reality:
- `state/` collapses to a single `sticker-model.ts` (drop `piece-model.ts`, `conversion.ts`, `solved.ts`, `equality.ts`, `hash.ts`).
- `moves/` drops `tokenizer.ts` (parser handles tokenization).
- `fixtures/` keeps `known-scrambles.json`; drops `pll-cases.json` and `oll-cases.json` (canonical states live inline as exports).
- Adds the `puzzle/` directory with `puzzle.interface.ts` and `puzzle-3x3.ts`.

**Public API block** — replace placeholder names with delivered names and add the puzzle seam:

```ts
import {
  Puzzle, Puzzle3x3,
  parseAlgorithm, applyAlgorithm,
  invertAlgorithm, mirrorAlgorithm, normalize,
  wcaScramble, scrambleIntoCase,
  recognizePll, recognizeOll, recognizeF2l,
  SOLVED_STATE, isSolved,
  fromStickerString, toStickerString, hashState,
  htm, stm, etm,
} from '@rubik/cube-core'
```

### 6.2 `docs/plans/2026-04-25-implementation/03-packages-cube-core.md`

- Step 2 changes from "piece + sticker models and conversions" to "sticker model" (matches reality; piece model not needed for current consumers).
- Step 3 stays (parser handles tokenizer too — no separate file).
- New step 10: "Add `Puzzle<TState, TMove>` interface and `Puzzle3x3` const composing flat exports."
- Deliverables tree: drop `piece-model.ts`, `conversion.ts`, `solved.ts`, `equality.ts`, `hash.ts`, `tokenizer.ts`, `pll-cases.json`, `oll-cases.json`. Add `puzzle/puzzle.interface.ts` and `puzzle/puzzle-3x3.ts`.
- "Done when" gets one new check: `Puzzle3x3` exported and round-trips a state through the interface only.

---

## 7. Commits

Two-commit shape, in order:

1. `feat(cube-core): add Puzzle interface + Puzzle3x3 (plan 03 phase 2)` — adds the two new files + spec + index.ts re-exports.
2. `docs(plans): align cube-core plan with delivered shape` — updates §20.1 and plan 03.

Both commits independently green (`pnpm typecheck && pnpm lint && pnpm test`). Lowercase Conventional Commits per `080-process-rule.md`.

---

## 8. Done when

- [ ] `packages/cube-core/src/puzzle/puzzle.interface.ts` exports `Puzzle<TState, TMove>`.
- [ ] `packages/cube-core/src/puzzle/puzzle-3x3.ts` exports `Puzzle3x3` typed as `Puzzle<State, Move>`.
- [ ] `packages/cube-core/src/index.ts` re-exports both.
- [ ] `puzzle-3x3.spec.ts` passes; coverage stays ≥95%.
- [ ] §20.1 of the master design reflects the delivered file structure and public API.
- [ ] Plan 03 `03-packages-cube-core.md` reflects the delivered deliverables and adds the puzzle step.
- [ ] Plan 03 "Done when" all check.

## 9. Out of scope

- Puzzle implementations beyond 3x3 (v2).
- Recognition on the interface (puzzle-specific, see §2.2).
- Metric helpers on the interface (3x3-specific, see §2.2).
- Renaming any existing flat exports (kept as-is per §1.2).
- Splitting `sticker-model.ts` into separate files (kept as-is per §1.2).
