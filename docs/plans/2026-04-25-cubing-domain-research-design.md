# Cubing Domain Research and Schema Validation

A research design doc that grounds the database and system structure for the rubik platform in the actual speedcubing landscape. The master design (`docs/plans/2026-04-25-rubik-platform-mvp-design.md`) defines the architecture and the §21 Prisma schema; this doc validates those decisions against real terminology, real content sources, and real libraries — and ratifies a small set of concrete deltas and source picks for plans 02–06.

## 1. Goal and non-goals

### 1.1 Goal

Convert "I think I understand cubing" into "I have evidence that the schema, the content pipeline, and the library posture survive contact with the community standard," with a paper trail of decisions a reader can audit later.

### 1.2 Non-goals

- Restating §21 / §22 of the master design. This doc references; it does not duplicate.
- Specifying implementation details for `cube-core` / `visualizer`. Those belong to plans 03–04.
- Choosing a CFOP curriculum or learning path. Pedagogy is post-MVP.
- Roux/ZZ deep curation. Sketched only enough to confirm the schema extends without changes.

### 1.3 Method

Two waves of WebFetch / WebSearch against canonical community sources (speedsolving wiki, jperm.net, SpeedCubeDB, the WCA regulations) plus library sources on GitHub (cubing.js, Cride5/visualcube). Findings cross-checked against §21's Prisma schema and §22's content shape. Live-tested the chosen image-rendering host with `curl`.

---

## 2. Domain primer (the parts that affect the schema)

### 2.1 WCA notation (Article 12)

- **Face moves** — `U R F D L B`, with modifiers `'` (counter-clockwise) and `2` (180°).
- **Wide moves** — `Uw Rw Fw Dw Lw Bw` with the same modifiers; numeric prefix `nUw` selects how many slices (n=2 implicit on 3x3). Lowercase `u r f d l b` is also a wide-move shorthand and appears throughout community content (e.g., `l b d'` in SpeedCubeDB's T-perm alternate). Per Regulation 12a2+: "both Rw and 2Rw are valid notation for the same physical move for the 3x3x3 Cube."
- **Slice moves** — `M E S` (and primes/2). **Not** in the WCA Article 12 list (which only covers faces / wide / rotations) but universally used in community algorithms. Our parser must accept them on 3x3.
- **Rotations** — `x y z` with `'` and `2`. Count as **0 moves under OBTM** but **1 move under ETM**.
- **Higher-N puzzles** add `nRw` with `n > 1, n < N`. Out of scope for v1, but the parser shape should leave room.

**Implication for the schema:** §22.2's `case_state` and §22.3's notation parser can accept the full character set `[UDLRFBudlrfbMESxyz'2 ]*`, matching VisualCube's documented input alphabet exactly. No schema change needed; this is a `cube-core` parser-scope confirmation.

### 2.2 CFOP layers and case counts

| Layer | Cases | Source confirms |
|---|---|---|
| **Cross** | intuitive | speedsolving wiki — no algorithmic case set |
| **F2L** | 41 (up to symmetry) | speedsolving wiki: "41 Last slot F2L (up to symmetry)"; one displayed case (#37) is "Solved" — trivial, no algorithm |
| **OLL** | 57 | speedsolving wiki — also organized into shape families and an OCLL subset (cases 21–27) |
| **PLL** | 21 | speedsolving wiki — split into 4 edges-only, 3 corners-only, 14 mixed |

CFOP total: **41 + 57 + 21 = 119 algorithmic cases**, matching the master design's "119 cases" framing.

The community publishes **multiple variants per case** universally:
- F2L: 3–7 per case (often dependent on which slot is empty: y / y' / d setups).
- OLL: 4–15+ per case.
- PLL: 4–15+ per case (SpeedCubeDB shows T-perm with at least 4 published, the top variant at 210 community votes).

### 2.3 Recognition

- **PLL** — distinguished by **swap-cycle patterns**. T-perm: "swaps the UL and UR edges, as well as the UFR and UBR corners." Recognition is "headlights, bars, blocks" combined with corner/edge cycle detection.
- **OLL** — combines **edge-orientation status** (all correct / none correct / mixed) with **corner-orientation patterns**. Shape families: square, lightning bolt, fish, knight move, awkward, P/W/L/C/T/I-shape, all-corners-oriented.
- **F2L** — **corner position + edge position + relative orientation** between corner and edge. Wiki organizes the 41 cases into 9 recognition categories (Basic Inserts; Reposition Edge; Reposition Edge and Flip Corner; Split Pair by Going Over; Pair Made on Side; Weird Cases; Corner in Place, Edge in U Face; Edge in Place, Corner in U Face; Edge and Corner in Place).

These 9 F2L categories, the OLL shape families, and the PLL permutation classes are all **subgroupings within a single set**. They map cleanly to `AlgorithmCase.tags: String[]` in §21 — no schema change needed.

### 2.4 4-look last layer (4LLL) and full last layer

- **2-look OLL** = 9 algorithms (orient edges, then OCLL).
- **2-look PLL** = 6 algorithms (corner cycle + edge cycle).
- **Full OLL + PLL** = 78 dedicated algorithms.

The master design targets full OLL + PLL. 4LLL is a learning path / curriculum overlay, not a separate set. Implication: not modeled in v1; if/when curriculum lands, it sits on top of the catalog as an ordering hint, not a structural change.

### 2.5 Move-count metrics

Three appear in the wild:

- **HTM** (Half-Turn Metric) — every face turn or 180° counts 1; rotations 0.
- **STM** (Slice-Turn Metric) — adds slice moves (M/E/S) at cost 1 each.
- **ETM** (Execution Turn Metric) — counts every executed move including rotations.

§21 stores `moveCountHtm` + `moveCountStm` on `AlgorithmVariant`. SpeedCubeDB exposes ETM + STM. We don't need ETM in v1 — it's derivable as `htm + (rotation count)`, and it's a less-common community standard than HTM. **No schema change.**

### 2.6 Roux + ZZ extensibility sketches

**Roux:** four steps (FB → SB → CMLL → LSE). Only **CMLL** has a formal algorithmic set (~42 algorithms). LSE is largely intuitive but subdivides into micro-steps 4a (orient M/E edges), 4b (place UL/UR), 4c (M-slice). LSE substeps are below `AlgorithmSet` in our hierarchy — best modeled as `AlgorithmCase.tags` (e.g., `lse-4a`, `lse-4b`) for v1; promote to a sub-set table only if the UI grows hierarchical browsing.

**ZZ:** EOLine/EOCross → ZZF2L → last layer (typically OCLL+PLL or COLL+EPLL or full ZBLL). ZZ's F2L is structurally distinct from CFOP's F2L (edges pre-oriented, fewer recognition cases). In our schema each `Method` owns its own `AlgorithmSet` rows, so `zz/zzf2l` and `cfop/f2l` are independent rows with no shared identity — the schema accommodates this without change.

ZBLL is **493 cases** (or fewer with mirrors). Schema is data-volume-agnostic; not a problem.

**Conclusion:** §21's hierarchy survives Roux/ZZ without schema changes. Tag-driven subgrouping covers the rare sub-set granularity (Roux LSE).

---

## 3. Schema validation against §21

A walk through each entity, with concrete findings.

### 3.1 Hierarchy

`Puzzle → Method → AlgorithmSet → AlgorithmCase → AlgorithmVariant` — confirmed by every authoritative source. T-perm appears under PLL under CFOP under 3x3 across speedsolving, SpeedCubeDB, jperm.net, and AlgDB-archived. **No change.**

### 3.2 `case_count_expected` semantics

§21 stores the expected count per set. The community standard for F2L is 41 (up to symmetry), even though one displayed case (#37) is the trivially-solved state. **Decision:** v1 emits `case_count_expected: 41` and **excludes** the solved case from `content/`. This matches community vocabulary; users counting "I've learned 30/41 F2L" expect a denominator of 41.

### 3.3 `RecognitionBasis` enum coverage

Current enum: `LAST_LAYER, F2L_SLOT, OLL_ORIENTATION, PLL_PERMUTATION, CROSS, OTHER`. Findings:

- CFOP: covered (F2L_SLOT for F2L, OLL_ORIENTATION for OLL, PLL_PERMUTATION for PLL, CROSS for cross).
- Roux CMLL: maps to `LAST_LAYER` (corners-of-last-layer recognition). Acceptable.
- Roux LSE / micro-steps: `OTHER` until structural support lands.
- ZZ-OCLL / COLL / ZBLL: maps to `LAST_LAYER`. ZZ's F2L: `F2L_SLOT`.

**No change.** Adding `EDGE_ORIENTATION` and `CORNER_ORIENTATION` as separate values would help disambiguate ZZ-EO from CFOP-OLL but isn't required for v1.

### 3.4 `AlgorithmCase.tags` carries subgroupings

OLL's 12+ shape families, F2L's 9 recognition categories, PLL's 3 permutation classes, Roux LSE's micro-steps — all fit cleanly into `tags: String[]`. We adopt these tag conventions:

- **OLL shape families:** `oll-shape-fish`, `oll-shape-square`, `oll-shape-lightning-bolt`, `oll-shape-knight-move`, `oll-shape-awkward`, `oll-shape-p`, `oll-shape-w`, `oll-shape-l`, `oll-shape-c`, `oll-shape-t`, `oll-shape-i`, `oll-shape-dot`, `oll-shape-cross`, `oll-shape-headlights`.
- **OLL OCLL subset:** `oll-ocll` (the 7 cases used in 2LLL OCLL).
- **F2L recognition categories:** `f2l-basic-insert`, `f2l-reposition-edge`, `f2l-reposition-edge-flip-corner`, `f2l-split-pair-over`, `f2l-pair-made-on-side`, `f2l-weird`, `f2l-corner-in-place-edge-in-u`, `f2l-edge-in-place-corner-in-u`, `f2l-edge-and-corner-in-place`.
- **PLL permutation classes:** `pll-edges-only`, `pll-corners-only`, `pll-mixed`.
- **Cross-cutting recognition cues:** `headlights`, `bar`, `block`, `adjacent-corner-swap`, `diagonal-corner-swap`, `edge-2-cycle`, `edge-3-cycle`.

These are surfaceable as filter chips on the catalog UI later; v1 just stores them. **No schema change.**

### 3.5 `AlgorithmVariant` metadata: gaps and non-gaps

| Source-side metadata | §21 has it? | Decision |
|---|---|---|
| `notation` (string, WCA) | ✅ | — |
| HTM move count | ✅ `moveCountHtm` | — |
| STM move count | ✅ `moveCountStm` | — |
| ETM move count | ❌ | **Skip** — derivable; not a v1 product surface |
| Author / source attribution | ✅ `attribution` | — |
| Fingertrick walkthrough | ✅ `fingertrickMd` | — |
| `is_primary` flag | ✅ | — |
| Display order | ✅ `displayOrder` | — |
| **Video URL** (e.g., YouTube tutorial) | ❌ | **Add** — SpeedCubeDB includes per-variant video links; cheap to model and useful on the case page |
| Gen group ("3GEN (R U F)" / "RU 2GEN") | ❌ | **Skip** — derivable from `notation` (set of distinct face letters); compute lazily, don't store |
| Community vote count | ❌ | **Skip** — community-source-specific; not our truth to maintain |

**Schema delta proposed (one field):**

```prisma
model AlgorithmVariant {
  // …existing fields…
  videoUrl  String?  // optional walkthrough/teaching link; sourced per-variant in YAML
}
```

YAML parallel:

```yaml
variants:
  - notation: R U R' U' R' F R2 U' R' U' R U R' F'
    is_primary: true
    attribution: SpeedCubeDB community standard
    video_url: https://www.youtube.com/watch?v=PX1R7VW9YTs
```

Rationale: §21.10 defers "videos" implicitly under deferred media assets, but a single optional URL field is one column, one regex check (`^https?://`), and a clear UX win on the case page. Cheap.

### 3.6 `AlgorithmCase.case_state` — F2L's partial-state problem

For PLL/OLL the 54-character state describes the full cube. For F2L the relevant state is **one slot's worth of stickers** plus the cross — most of the cube is "irrelevant" and shouldn't dictate a render.

VisualCube already solves this with two convention characters:

- `n` — blank facelet (rendered grey, "this sticker doesn't matter").
- `t` — transparent facelet (not drawn at all).

The §22 sticker alphabet is currently described as "54-char sticker string in the valid sticker alphabet." We extend the documented alphabet to include `n` and `t` for masked stickers, matching VisualCube's `fd` parameter. The visualizer reads the same convention.

**Schema delta: none.** This is a documentation update to §22.3's "valid sticker alphabet" definition + `cube-core`'s state parser accepting these two extra characters.

### 3.7 OLL numbering

The community uses numeric slugs `oll-1` through `oll-57`. An older "O1–O8, O20" scheme exists but has fallen out of use. **Pick:** numeric slugs `oll-1`…`oll-57`, plus a friendly `displayName` like `OLL 27 (Sune)`. Same for F2L (`f2l-1`…`f2l-41`, excluding the solved case). PLL keeps letter slugs (`t-perm`, `aa-perm`, `ua-perm`, `ub-perm`, `ga-perm`, etc.) since letter codes are universally recognized and have no numeric equivalent.

### 3.8 ZBLL volume

493 cases at ~1KB per YAML file ≈ 500KB of content. Negligible. Not in v1, but the schema does not need pagination, sharding, or any change.

---

## 4. Content sources for v1 seed

### 4.1 Landscape (post-research)

| Source | Status | Coverage | Data shape | License |
|---|---|---|---|---|
| **AlgDB.net** | ❌ Dead — under-construction page | n/a | n/a | n/a |
| **SpeedCubeDB** (speedcubedb.com) | ✅ Active, occasional outages | Every 3x3 set + 2x2/4x4/5x5/6x6/SQ1/Pyra/Mega; CMLL, COLL, ZBLL, ELL, OLLCP, VLS, 1LLL, etc. | HTML pages at REST-y URLs (`/a/3x3/PLL/T`); algorithms with vote counts, ETM/STM, gen group, optional YouTube link | None stated |
| **jperm.net** | ✅ Active | PLL/OLL/F2L trainers + reference pages | JS-rendered (raw HTML insufficient for scraping) | © J Perm |
| **speedsolving.com wiki** | ✅ Active | Every method / set / case named, with prose recognition | MediaWiki HTML; algorithms embedded in tables | CC-BY-SA via MediaWiki standard |
| **AlgDB (cubing org GitHub)** | ⚠️ "in development" | Successor project; no production endpoint | Not yet | TBD |
| **CubeSkills (Feliks Zemdegs)** | ✅ Active (paywall) | High-quality curated curriculum | Paywalled — not a v1 source | © CubeSkills |

### 4.2 Per-set picks for v1 seed

| Set | Primary source | Secondary source (prose / canonical names) |
|---|---|---|
| **PLL** | SpeedCubeDB top-voted alg per case + 1–2 alternates | speedsolving wiki for letter codes, recognition prose |
| **OLL** | SpeedCubeDB | speedsolving wiki for shape-family tags + names like "Sune" / "Antisune" |
| **F2L** | SpeedCubeDB (skip case 37) | speedsolving wiki for the 9 recognition categories |
| **Cross** | n/a (intuitive, no algorithmic content) | n/a |

### 4.3 What we author ourselves

- **Recognition prose** (`recognition_md` per case) — drawn from speedsolving, paraphrased into our voice. Mention specific stickers using face letters when ambiguity matters ("Two adjacent yellow headlights on F"; "Bar on the L face") per `060-content-rule.md`.
- **`case_state`** — computed by `cube-core`: `applyAlgorithm(solvedState, inverseAlgorithm(primary_notation))`. We never source this externally; it's derived, then human-checked against a VisualCube preview (see §6).
- **Tags** — assigned per the conventions in §3.4.

### 4.4 Attribution policy

Each `AlgorithmVariant.attribution` carries a short string. Conventions:

- Where the original author is known and credited by the source (e.g., a specific cuber's published variant), preserve their name: `attribution: "Bldcuber via SpeedCubeDB"`.
- Where the source is the community at large: `attribution: "SpeedCubeDB community"`.
- Where we authored the variant (rare in v1): `attribution: "rubik-platform"`.

A new file `content/SOURCES.md` (added in plan 06) lists every external source and our stance on each.

### 4.5 Licensing risk and mitigation

Algorithms (sequences of moves) are **functional** and not copyrightable. Recognition prose we author. Images we generate. The remaining concern is **attribution**: SpeedCubeDB has no explicit license but the content is community-contributed and conventionally treated as free-to-redistribute with credit.

**Mitigations:**

1. **Always carry attribution** in `AlgorithmVariant.attribution`.
2. **`content/SOURCES.md`** with a per-source statement of what we used and why.
3. **Treat the content directory as the audit surface.** Anyone can submit a takedown PR for their attributed variant; we'll honor it.
4. **Be conservative with prose.** Recognition copy is paraphrased, not copy-pasted from speedsolving's CC-BY-SA text.

This is the same posture the community has used for over a decade and matches what other open speedcubing tools (cubing.js, j2cube, pll-trainer) do.

### 4.6 Authoring loop (with QA image)

For each new case YAML:

1. Pick a `primary_notation` from SpeedCubeDB (top-voted).
2. Author or copy `recognition_md` (paraphrased).
3. Run `make content.validate` — `cube-core` derives `case_state` and confirms `applyAlgorithm(solved, inverse(notation))` matches.
4. **(New, soft):** open the VisualCube QA URL (§6.2) in a browser, eyeball that the rendered state is the case you intended.
5. Commit; PR.

Step 4 is a content-author convenience, not a machine check — humans catch things like "the wide-move regrip variant solves a mirror of the case I meant."

---

## 5. Library landscape (reference, not vendored)

### 5.1 cubing.js — the comprehensive reference

- **License:** Mozilla Public License (MPL). Free to use; modifications-to-cubing.js-itself must be published.
- **Authors:** Lucas Garron (`@lgarron`), Tom Rokicki (`@rokicki`), with scramblers from Chen Shuang (`@cs0x7f`).
- **Module surface:**
  - `cubing/alg` — `Alg` class; parser supporting WCA + SiGN + commutators (`[R, [U': L']]`); methods: `.invert()`, `.expand()`, `.log()`.
  - `cubing/kpuzzle` — generic puzzle definition framework. Files: `KPattern.ts`, `KTransformation.ts`, `KPuzzleDefinition.ts`, `KPuzzleDefinitionJSON.ts`. State = pattern (orientation + permutation per orbit); move = transformation; puzzle = JSON definition data.
  - `cubing/twisty` — `<twisty-player>` web component (heavy, three.js-based).
  - `cubing/scramble` — `randomScrambleForEvent("333")` returning an `Alg`. Uses Chen Shuang's two-phase solver port internally.
  - `cubing/bluetooth` — smart-cube device connection.

### 5.2 What `cube-core` inherits conceptually

- **Two-representation state model.** cubing.js uses pattern (orientation/permutation arrays, allocation-cheap) and converts to sticker arrays for rendering. The master design (§4 "Cube state representation") makes the same call: piece-orientation internal, sticker-array external. Validates the design.
- **`Alg` API surface.** Our public API mirrors the same shape: `parseAlgorithm`, `applyAlgorithm`, `inverseAlgorithm`, `expandWideAndRotations`, `mirror`. Naming convergence helps anyone fluent in cubing.js.
- **Move composition as transformation composition.** `cube-core`'s `applyAlgorithm` is `moves.reduce(state, applyMove)` where `applyMove` permutes pieces and updates orientation deltas — same algebra as KTransformation × KPattern.

### 5.3 What `cube-core` rejects

- **The full KPuzzle JSON definition framework.** v1 only targets 3x3. Hard-coding the 3x3 piece-orientation model is faster, smaller, and easier to test than a generic data-driven engine. v2 can lift to KPuzzle-shaped if and when 4x4/megaminx land.
- **Vendoring as a runtime dep.** `cubing/twisty` brings three.js + significant size; `cubing/scramble` includes a Kociemba-port lookup table. The visualizer is home-grown SVG SSR + three.js client; the scrambler in v1 is random-move, not random-state.
- **`<twisty-player>`'s web-component approach.** Our visualizer is a React component (matches the rest of `apps/web`), not a custom element.

### 5.4 cubing.js as a v1.5 dep candidate

One narrow case is worth flagging: **random-state scrambling**. WCA-grade random-state scrambles (like the 21–25 move scrambles the WCA generates for competitions) require a two-phase solver. Implementing Kociemba is 1–2 weeks of work; vendoring `cubing/scramble` is `pnpm add cubing` + 8 lines of glue.

**v1 stance:** random-move scramblers in `cube-core/scramble` (25 random face turns avoiding obvious cancellations). Cheap and correct enough for the timer feature.

**v1.5 evaluation:** if user feedback flags scramble quality, evaluate a `cubing/scramble` runtime dep (server-side import only, kept out of the client bundle). Open question §7.2.

### 5.5 min2phase / Kociemba (for a future solver)

`cs0x7f/min2phase` is the Java reference; `cubing/search` includes JS ports. Neither is needed for v1; both are options for v2 when the **Solver feature** lands (master design §13 "Roadmap beyond v1").

### 5.6 VisualCube — out-of-runtime QA

- **License:** LGPL-3.0 / GPL-3.0 (Cride5/visualcube on GitHub).
- **Status:** v0.5.5 on the cubing.net mirror; original (cube.crider.co.uk) and rider.biz mirrors have flaky CLI access (anti-bot walls / rate limits). Browser access is fine.
- **Use:** content-author QA only. Per §6.

### 5.7 AnimCubeJS / Roofpig

Legacy. Skip.

---

## 6. Image strategy (decision recap)

The brainstorm settled option **(b)**: VisualCube during content authoring as a QA reference; visualizer at runtime.

### 6.1 Mirror picked

`https://visualcube.api.cubing.net/` — verified live (HTTP 200, 4802-byte SVG, content-type `image/svg+xml`) for:

```
https://visualcube.api.cubing.net/?fmt=svg&size=200&view=plan&stage=pll&case=RUR'U'R'FR2U'R'U'RUR'F'
```

(That's the T-perm primary algorithm with `stage=pll` masking the cube to last-layer-only and `view=plan` rotating the U-face to the top.)

The `crider.co.uk` and `rider.biz` mirrors return JS anti-bot walls or transient 500s under `curl`; they work in browsers but are not script-friendly. **Pin `visualcube.api.cubing.net` as the documentation reference URL.**

### 6.2 URL pattern (for content authoring)

```
https://visualcube.api.cubing.net/?fmt=svg&size=200&view=plan&stage=<set>&case=<alg>
```

Where:

- `fmt=svg` — vector format, scales without artifacts.
- `size=200` — px square; adjust 100–400 for screen vs. doc embed.
- `view=plan` — rotates U-face up, shows top + side strips. `view=oblique` for full 3D angle.
- `stage` — masks irrelevant stickers. Values most relevant to us: `pll` (last-layer permute), `oll` (last-layer orient), `f2l_1`/`f2l_2`/`f2l_3` (slot-specific), `cross`, `f2b` (Roux first two blocks), `cmll`, `coll`, `oell`, `vh`, `els`. Full list in `Cride5/visualcube/visualcube_api.php`. Optional rotation suffix: `stage=cross-x2` rotates the cross to U.
- `case=<alg>` — applies the **inverse** of `<alg>` to a solved cube, displaying the state that `<alg>` would solve. **No spaces**; use `'` and `2` directly. For `R U R' F'` write `RUR'F'`.

### 6.3 Why not embed in the schema

We do not store VisualCube URLs in the database. The image is **derived** from `notation` + `set`; storing it would create drift on every variant update. It belongs in:

- **Content YAML as an optional comment-style field** (`# qa_preview: <url>`) — not parsed, just human-friendly.
- **Author docs** in `docs/plans/2026-04-25-cubing-domain-research-design.md` (this doc).
- **The visualizer's golden-image test fixtures**, where we cache one VisualCube SVG per representative case to compare against our own SVG render in CI.

### 6.4 Runtime picture

The visualizer renders every preview at runtime — no external dependency. SSR SVG for catalog grids; three.js for the case page's interactive 3D. VisualCube has zero runtime presence. If `visualcube.api.cubing.net` goes dark tomorrow, only the content-author QA loop is affected; production keeps rendering.

---

## 7. Decisions ratified

A consolidated list of every decision this doc commits to. Each one feeds a downstream plan.

### 7.1 Schema deltas (one field; rest of §21 unchanged)

1. **Add `AlgorithmVariant.videoUrl: String?`** — nullable, regex-validated as URL. Sourced per-variant in YAML.

That's it. Everything else fits §21 as written.

### 7.2 Documentation updates (no schema change)

2. **§22.3 sticker alphabet** documented to include `n` (blank) and `t` (transparent) for masked F2L cases, matching VisualCube's `fd` convention.
3. **`content/SOURCES.md`** added in plan 06 listing per-source attribution stance.

### 7.3 Content-source picks

4. **Primary content source: SpeedCubeDB**, top-voted variant per case + 1–2 alternates.
5. **Secondary: speedsolving.com wiki** for canonical names + recognition prose source material (paraphrased, not copied).
6. **F2L count: 41** (exclude the trivially-solved case 37); slugs `f2l-1`…`f2l-41`.
7. **OLL slugs: numeric** `oll-1`…`oll-57`; display names like "OLL 27 (Sune)".
8. **PLL slugs: letter codes** (`t-perm`, `aa-perm`, `ua-perm`, etc.).
9. **Tag conventions** for OLL shape families, F2L recognition categories, PLL permutation classes (concrete list in §3.4).

### 7.4 Library posture

10. **`cube-core` is home-grown.** Conceptual reference: cubing.js's KPattern/KTransformation algebra. Public API mirrors `Alg`-style naming.
11. **`cube-core/scramble` v1 is random-move.** Random-state scramble deferred (§7.2 open question).
12. **No cubing.js runtime dep in v1.** Re-evaluate in v1.5 only for scramble quality.
13. **No min2phase / Kociemba in v1.** Solver is a v2 feature.
14. **VisualCube is content-author QA only**, never a runtime path.

### 7.5 Image strategy

15. **Image strategy (b) ratified.** Visualizer renders runtime; VisualCube `visualcube.api.cubing.net` URL pattern documented for authoring QA and golden-image tests.

### 7.6 Notation parser scope

16. **Parser accepts `[UDLRFBudlrfbMESxyz'2 ]*`** — WCA Article 12 face/wide/rotation + community standard slice (M/E/S) + lowercase wide shorthand. No SiGN extensions in v1. No commutator brackets (`[A, B]`) in v1.

---

## 8. Open questions and risks

### 8.1 SpeedCubeDB stability

Search results surfaced a thread titled "Speedcubedb completely stopped (again)." The site is a single-maintainer hobby project. **Risk:** primary content source goes dark mid-curation. **Mitigation:** snapshot the per-case pages we use into `content/SOURCES.md` references; speedsolving wiki is the always-available fallback. Snapshot work is done as part of plan 06.

### 8.2 Random-state scramble quality

Open question: do we ship random-move scrambles in v1's timer, or pull `cubing/scramble` server-side? **Recommendation:** ship random-move; flag for re-evaluation if user feedback lands.

### 8.3 License formalization for content

`content/SOURCES.md` is the v1 mitigation. v2 may want a per-variant `licenseId` field tying to a `License` table — overkill for now.

### 8.4 Roux LSE substep modeling

Tags handle it for v1. If a Roux user-experience plan ever wants hierarchical browsing of LSE 4a / 4b / 4c, promote tags to a `AlgorithmSubset` table at that point — schema migration, not a redesign.

### 8.5 Color-blind / sticker color customization

The visualizer's sticker palette is a domain token (per `020-styling-rule.md`). Color-blind support belongs on `User` preferences (a JSONB column or a `UserPreference` table). **Deferred.** Out of scope for content/schema research; flagged here so it isn't lost.

### 8.6 OpenAPI spec implications

The schema delta (videoUrl) flows through to `packages/shared/schemas/` and the api's OpenAPI emit. Plan 02 (`@rubik/shared`) and plan 05 (`apps/api`) should land the field; plan 06 (initial content) populates it.

---

## 9. Downstream impact summary

| Plan | Picks up |
|---|---|
| **02 — packages-shared** | `AlgorithmVariant.videoUrl` in zod schemas; sticker alphabet `n` / `t` in content schema |
| **03 — packages-cube-core** | Notation parser scope; HTM+STM metric helpers; conceptual KPattern model |
| **04 — packages-visualizer** | `n` / `t` masking convention; visualizer reads `recognitionBasis` to derive default stage |
| **05 — apps-api** | Migration adding `video_url` to `algorithm_variants`; OpenAPI emit |
| **06 — initial-content** | Source picks per-set; `content/SOURCES.md`; F2L=41 with slug-numbering scheme; OLL/F2L/PLL tag taxonomy |

---

## 10. Sources

- [WCA Regulations Article 12 (Notation)](https://www.worldcubeassociation.org/regulations/#article-12-notation)
- [Speedsolving Wiki — CFOP method](https://www.speedsolving.com/wiki/index.php/CFOP_method)
- [Speedsolving Wiki — F2L](https://www.speedsolving.com/wiki/index.php/F2L)
- [Speedsolving Wiki — OLL](https://www.speedsolving.com/wiki/index.php/OLL)
- [Speedsolving Wiki — PLL](https://www.speedsolving.com/wiki/index.php/PLL)
- [Speedsolving Wiki — Roux method](https://www.speedsolving.com/wiki/index.php/Roux_method)
- [Speedsolving Wiki — ZZ method](https://www.speedsolving.com/wiki/index.php/ZZ_method)
- [SpeedCubeDB — 3x3](https://www.speedcubedb.com/a/3x3) / [PLL](https://www.speedcubedb.com/a/3x3/PLL) / [T-perm](https://www.speedcubedb.com/a/3x3/PLL/T)
- [jperm.net — PLL trainer](https://jperm.net/algs/pll)
- [cubing.js on GitHub](https://github.com/cubing/cubing.js) — `src/cubing/kpuzzle/{KPattern,KTransformation,KPuzzleDefinition}.ts`
- [Cride5/visualcube on GitHub](https://github.com/Cride5/visualcube) — `visualcube_api.php`
- [VisualCube hosted mirror](https://visualcube.api.cubing.net/)
