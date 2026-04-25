# Content Authoring Conventions

Algorithm content lives as YAML files in `content/`, ingested into Postgres by `apps/api/prisma/seed.ts`. Full pipeline at §22. This file pins the conventions for adding/editing content.

## Layout

- **One file per case.** `content/puzzles/3x3/methods/cfop/sets/pll/cases/t-perm.yaml` is one case. Don't bundle multiple cases in a single file.
  - Why: per-case files = per-case PRs = per-case review. Bundling defeats blame-ability.
- **`puzzle.yaml`, `method.yaml`, `set.yaml`** sit at the appropriate level. One per node in the tree.
  - Why: parallel structure to the URL routing (`/3x3/cfop/pll/t-perm`); easy to find which file owns what.
- **Fixtures mirror the structure** under `content/fixtures/` with a tiny subset (1–2 cases per set).
  - Why: tests run against fixtures, not real content; tests should stay fast and not require keeping the fixtures in sync with the full corpus.

## Slugs and naming

- **Slugs are kebab-case, alphanumeric + hyphens.** `t-perm`, `aa-perm`, `corner-edge-front`. Regex: `/^[a-z0-9]+(-[a-z0-9]+)*$/`.
  - Why: URL-safe, consistent with file paths, validated by the content schema (§22.3).
- **Filename = slug.** `t-perm.yaml` contains `slug: t-perm`. Validation enforces parity.
  - Why: rename one without the other and you have a silent breakage. The check fails fast in CI.
- **`display_order` is unique within its parent and 0-indexed.** A set's cases use `display_order: 0…N-1` in canonical sequence.
  - Why: the grid render iterates by display_order; gaps and duplicates produce visual surprise.

## Case state

- **`case_state` is exactly 54 characters in the sticker alphabet.** Whitespace permitted; normalized at parse.
  - Why: a 3x3 cube has 54 stickers. Wrong length = wrong cube; the validator rejects.
- **The state must match what the primary algorithm solves.** Validator runs `applyAlgorithm(solvedState, inverse(notation))` and compares — sanity check that the published alg actually solves the declared state.
  - Why: the most common authoring error is "I copied the wrong algorithm." This check catches it at PR time, not after launch.

## Variants

- **Exactly one variant per case has `is_primary: true`.** All others are alternates.
  - Why: the case page features the primary; multiple primaries = ambiguous default.
- **Primary should be the most common, fastest, or most teachable variant.** Note `attribution` for the variant's source.
  - Why: the primary is what new learners see first; pick deliberately.
- **Alternates are encouraged.** Different finger-tricks, different angles (`x R2 D2 R' U' R D2 R' U R'`), different hand assignments.
  - Why: speedcubers learn through comparison; variant lists are part of the value proposition.

## Notation

- **WCA notation only** — face turns U/R/F/D/L/B with `'` and `2`; wide turns Uw etc.; slices M/E/S; rotations x/y/z. No proprietary notations.
  - Why: WCA is the universal language; cube-core's parser only handles WCA.
- **Single space between moves; no leading/trailing whitespace.** `R U R' U'`, not `RUR'U'` or `R  U  R'`.
  - Why: parser tolerates extra spaces but normalization is content hygiene; tools that highlight notation expect single-space.
- **Don't include rotations as part of the move count claim.** If the alg starts with `x`, that's a setup, not a move; cube-core's metric counts honestly.
  - Why: `move_count_htm` should match what the metric returns, not what feels right.

## Recognition copy

- **`recognition_md` is plain markdown.** Headlines, bars, edges — describe the visual cues a solver looks for.
  - Why: the goal is fast pattern recognition; the prose mirrors how cubers actually think about the case.
- **Mention specific stickers using their face letters when ambiguity matters.** "Two adjacent yellow headlights on F"; "Bar on the L face".
  - Why: "this corner" is ambiguous; face-relative descriptions match how the case is taught.
- **Don't paste the algorithm into the recognition copy.** That's what `variants` is for.
  - Why: keeps the two concerns separate; reuse stays clean.

## Tags

- **Tags are kebab-case noun phrases.** `adjacent-corner-swap`, `edge-3-cycle`, `headlights`.
  - Why: matches how cubers categorize cases; enables filterable browsing later (`?tag=headlights`).
- **Use existing tags before inventing new ones.** Grep `content/` for current tags first.
  - Why: tag sprawl makes filtering useless. Three near-synonyms become four taxonomies.

## Validation and CI

- **`make content.validate` runs before every commit.** Pre-commit hook would be nice; CI gate is mandatory.
  - Why: bad content shouldn't reach `main`. Validation is fast; the cost is zero.
- **`make content.diff` shows DB ⇄ YAML drift** before a deploy.
  - Why: deploys without drift inspection are how production gains entries the YAML doesn't have.
- **A deliberately-broken alg is the regression test for the validator itself.** Add to `__tests__/content-validation.spec.ts`.
  - Why: catches regressions where the validator silently accepts a wrong alg — a category of bug uniquely bad for this product.

## Adding new content

1. Author the YAML file under the right path (filename = slug).
2. Run `make content.validate` locally — fix what fails.
3. Optionally: `make db.seed` to view in Prisma Studio.
4. Commit on a `content/<set>-<slugs>` branch with `content(<set>): add <case-or-cases>` message.
5. PR. CI re-runs validation.
6. Merge → deploy hook runs `prisma migrate deploy && prisma db seed` and revalidates each changed slug on `apps/web`.

- Why: predictable workflow + automatic deploy. New content is a PR, not a manual ops task.

## Editing existing content

- **Don't change a slug.** A slug is the URL; changing it breaks SEO, bookmarks, and `UserAlgorithm` rows that key on `caseId`.
  - Why: backlinks and user data hold the slug as identity. Renaming is a migration, not an edit.
- **Treat `case_state` as immutable** for a published case. If the state was wrong, that's a different problem requiring a coordinated fix.
  - Why: `case_state` shapes the visualizer thumbnail and the recognition copy; changing it under a stable slug confuses the whole graph.
- **Variant changes are safe.** Adding a new variant, changing fingertrick notes, demoting a primary to alternate — all fair game.
  - Why: variants are the iteration surface; the case identity stays stable.

## Deferred

- **Localization.** v1 English-only. v2 adds per-locale YAML files or a language column (§22.7).
- **Media assets.** v1 generates the cube state diagram from `case_state`; no recognition photos or videos.
- **In-app editing.** v1 edits via PR. v2 may add an admin UI that writes to the DB and syncs back to YAML.
