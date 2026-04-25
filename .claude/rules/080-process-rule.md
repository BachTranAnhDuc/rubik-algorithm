# Process Conventions

Commits, plans, PR hygiene, phased work. Enforced by Conventional Commits + the plans directory + branch protection on `main`.

## Commits

- **Conventional Commits, lowercase everything.** Format: `type(scope): subject`.
  - `feat(visualizer): add SVG PLLView with arrows`
  - `fix(api): handle 401 on /v1/me with refresh retry`
  - `refactor(cube-core): extract piece-orientation helper (phase 2)`
  - `docs(content): add t-perm case yaml`
  - Why: lowercase keeps `git log --oneline` and changelogs scannable; user preference on record.
- **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`, `perf`, `build`, `ci`, `content` (for `content/` YAML changes).
  - Why: matches what recent history uses; a `content` type makes content PRs trivially filterable.
- **Scope is the area, not the package.** `web`, `api`, `visualizer`, `cube-core`, `shared`, `content`, `prisma`, `auth`, `tooling`, `docs`.
  - Why: scopes communicate *what changed* for a reader skimming history.
- **Phased work gets a `(phase N)` suffix.** Example: `refactor(api): split catalog into submodules (phase 2)`.
  - Why: phased suffixes let `git log --grep "(phase 2)"` reconstruct a multi-commit migration.
- **Subject imperative, ≤72 chars, no trailing period.**
  - Why: Conventional Commits expectation; CI tools parse the subject.
- **Body explains *why*, not *what*.** The diff shows what.
  - Why: future-you knows *what* from the code; the motivation rots without the body.
- **Don't amend published commits.** Create a new commit.
  - Why: amending rewrites history others may have pulled.

## Planning docs

- **Architecture / design work starts at `docs/plans/YYYY-MM-DD-<topic>-design.md`.** The master design for v1 lives at `docs/plans/2026-04-25-rubik-platform-mvp-design.md`.
  - Why: design decisions need a place that isn't git history. PR descriptions don't survive long.
- **Implementation plans live under `docs/plans/YYYY-MM-DD-implementation/`** with one numbered file per phase (`01-bootstrap-monorepo.md`, etc.). Index in `README.md`.
  - Why: design = decisions, plan = work breakdown. Splitting them keeps each focused and re-readable.
- **Date is the day planning starts**, not the day it merges.
  - Why: file ordering reflects timeline; renaming creates churn.
- **Topic is kebab-case, short.** `cube-core`, `auth-flow`, `content-pipeline`. Add `-design` suffix for design docs; plans in the implementation directory don't need a suffix.
  - Why: keeps filenames navigable and consistent.
- **Plan sections:** problem/goal, deliverables, steps, "Done when" checklist, out-of-scope. Design sections are richer (see the master design for the shape).
  - Why: the structure forces the hard questions. "Done when" without "Approach" is a TODO list.
- **Plans get committed with `docs(<topic>): add <plan>`** or `docs(plans): add implementation phase NN`.
  - Why: `docs` reflects that the artifact is documentation, not feature code.

## Phased refactors

- **Big refactors ship as multiple commits, one phase each.**
  - Why: small commits + clear phases = reviewable, bisectable, revertable.
- **Phase 1 adds new primitives; phase 2+ migrates callers; final phase removes the old API.** Old API stays working until the last phase.
  - Why: this order keeps `main` shippable at every commit.
- **Each phase commit compiles, lints, and type-checks on its own.**
  - Why: bisect-ability. A half-broken intermediate commit ruins `git bisect` a year later.

## Branches

- **One branch per plan or per logical change.** Naming: `plan-NN-<short>` for executing a numbered plan, `<type>/<scope>-<short>` otherwise (`feat/visualizer-svg-views`, `fix/api-auth-refresh`).
  - Why: predictable branch names make PR queues readable.
- **`main` is always shippable.** No half-finished features merged in.
  - Why: every commit on main is a possible deploy candidate.
- **Default merge style: rebase + merge for clean history.** Squash for noisy work-in-progress branches; merge-commit only for explicitly-merged feature branches with multiple meaningful commits.
  - Why: linear history is easier to bisect; squash kills useful intermediate commits when they exist.

## Tooling and CI

- **`pnpm` is the package manager.** Lockfile is `pnpm-lock.yaml`. Don't generate `package-lock.json` or `yarn.lock`.
  - Why: mixing lockfiles causes install drift; CI pins to pnpm.
- **Don't skip hooks (`--no-verify`).** If a hook fails, fix the cause.
  - Why: hooks are how the repo stays consistent; bypassing imports the mess someone else cleans up.
- **Before pushing: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`.**
  - Why: CI runs these. Failing red on the PR is expensive round-tripping.
- **Husky + lint-staged on commit** runs ESLint fix + prettier on staged files only.
  - Why: formatted files hit main; review stays on content not whitespace.

## Pull requests

- **PR title mirrors the lead commit subject.** Conventional, lowercase.
  - Why: squash-merge surfaces the title in history.
- **PR body = problem, approach, test plan.** Link the design or plan doc.
  - Why: the reviewer evaluates the approach, not reverse-engineers from the diff.
- **Screenshots/GIFs for any UI change.** Both light and dark mode when modes render differently.
  - Why: UI changes that look fine to the author can regress the other mode.
- **Don't mix refactor + feature in one PR.** Land cleanup separately first.
  - Why: review time goes exponential with unrelated changes; bisect-ability dies.

## Docs and READMEs

- **Don't add top-level `README.md`, `CONTRIBUTING.md`, etc. without being asked.** The rules in `.claude/rules/` and the master design in `docs/plans/` are the source of truth.
  - Why: human-facing docs duplicate rule content and drift; add them after conventions are stable.
- **Plan docs are fine to add freely** — they're per-effort and don't compete with rule files.
  - Why: plans are the natural place for "what we're doing this week". Rules stay durable.

## When unsure

- **Grep for precedent.** If three files already do it one way, match them. If the ways differ, ask before adding a fourth.
  - Why: convergence beats correctness-in-isolation.
- **Check the master design (`docs/plans/2026-04-25-rubik-platform-mvp-design.md`) before reinventing.** It has 23 sections covering most architectural questions.
  - Why: the design is the source of truth; if it's wrong, update it rather than diverging silently.
- **Read the relevant rule before writing new code.** Each rule has a "Why:" — that's the lever for judgment calls at the edges.
  - Why: rules are short for a reason; load them once and the day's work goes faster.
