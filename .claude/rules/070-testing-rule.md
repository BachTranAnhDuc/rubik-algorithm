# Testing Conventions

Test pyramid by package/app at §11. This file pins what's tested where, the merge gates, and how fixtures flow.

## Pyramid

| Layer | Where | Tooling |
|---|---|---|
| Unit | `packages/*/__tests__/` | Vitest + fast-check (property-based) |
| Component (visualizer) | `packages/visualizer/stories/` | Storybook + Playwright snapshots |
| Integration (api) | `apps/api/test/integration/` | Vitest + Testcontainers |
| Contract (api) | `apps/api/test/contract/` | Vitest + OpenAPI snapshot |
| Component (web) | `apps/web/tests/` | Vitest + Testing Library |
| E2E (web) | `apps/web/e2e/` | Playwright |

## Coverage gates

- **`packages/cube-core` floor: ≥95% lines.** Hard CI gate. Falling below blocks merge.
  - Why: cube-core is the correctness heart (recognition, scrambler, future solver lean on it). Bugs cascade.
- **Other packages and apps: ≥80% soft target.** Not a gate; reviewers flag drops.
  - Why: chasing 100% in app code yields tests that mostly verify framework behavior. 80% catches the meaningful cases without the diminishing returns.
- **Coverage is `vitest --coverage` with v8 provider.** No istanbul.
  - Why: faster, no Babel transform, native to the toolchain.

## Property-based tests

- **`packages/cube-core` carries algebraic property tests** via fast-check:
  - `applyAlgorithm(seq) ∘ applyAlgorithm(inverseAlgorithm(seq)) = identity`
  - `mirror(mirror(seq)) = seq`
  - `cancel(normalize(x)) = cancel(x)`
  - Recognition round-trip: `scrambleIntoCase(c) → recognize → c`
  - Why: a single property test covers infinitely many sequences. Cheaper and stronger than enumerated examples.
- **Default 100 runs per property; bump to 1000 in CI nightly if we add one.** Don't run 1000 on every PR.
  - Why: 100 is enough to catch bugs; 1000 is a CI cost.

## Test data

- **Fixtures live in two places**: `packages/cube-core/fixtures/` for puzzle data (known scrambles, case fingerprints), `content/fixtures/` for content YAML.
  - Why: parallel structure to the real artifacts they mirror. Tests don't depend on the full corpus.
- **Postgres test DB is real Postgres via `testcontainers`** — not SQLite, not mocked Prisma. Each test runs in a transaction that rolls back.
  - Why: SQLite's behavior diverges from Postgres in indexed JSON, full-text search, generated columns; mocking Prisma drifts. Real Postgres catches real bugs.
- **Seed the test DB from `content/fixtures/`** at suite startup, not from the full content directory.
  - Why: speed. Full content takes seconds; fixtures take milliseconds.
- **Known-scrambles corpus** (`packages/cube-core/fixtures/known-scrambles.json`) — ~20 entries each with scramble + state + canonical solution. Loaded by a regression test.
  - Why: locks behavior against published reference data. If a refactor breaks one, you'll know which.

## Merge gates

- **PR-blocking** (must pass on every PR): typecheck, lint, unit tests, api integration tests, content validation.
- **Branch-only** (run on `main` and labeled PRs): Playwright E2E, Storybook visual regression.
  - Why: E2E is expensive (real browser, real DB); running on every PR triples CI time. Labels enable opt-in for risky PRs.
- **Performance budget enforced via Lighthouse CI on the main branch.** LCP < 2.5s, CLS < 0.1 on the case page (§19.9).
  - Why: bundle perf regresses one rebase at a time; a budget catches it.
- **Coverage delta reported in PRs** but only blocks for cube-core ≥95%.
  - Why: visibility without the dev-loop tax of strict floors everywhere.

## What we don't test

- **Framework behavior.** No "this controller has the @Get decorator" tests.
  - Why: NestJS is already tested upstream; restating wires in our suite is dead code.
- **Third-party services at the boundary.** Google OAuth verification, Sentry capture, Upstash Redis — mocked at the seam, not over the wire.
  - Why: their SLAs aren't ours to verify; integration with their happy path is enough.
- **The full content corpus end-to-end.** Slow, brittle. Validation enforces shape; cube-core enforces correctness; rendering tests use fixtures.
  - Why: an end-to-end test against 119 cases is 119 times the cost for proportionally less value.

## Test shape

- **Arrange / Act / Assert with whitespace separators.** No comments naming the sections — the blank lines are the structure.
  - Why: comments narrating the structure are AI-slop (§code-style); whitespace is enough.
- **One behavior per test.** Multiple assertions are fine if they're about the same behavior.
  - Why: failure messages should point at the specific behavior; multi-behavior tests obscure which one broke.
- **Descriptive `it(...)` names: present-tense behavior.** "rejects t-perm with mismatched case_state", not "test1" or "should work".
  - Why: failure output is the title; the title should be the regression message.
- **`describe` blocks group by subject under test, not test type.** `describe('CaseSchema', ...)` not `describe('validation tests', ...)`.
  - Why: subject groupings survive refactors; type groupings split when you add a new case.

## Mocking

- **Mock at the boundary, not deep inside the unit.** Mock the outbound HTTP call to Google, not Passport's strategy class.
  - Why: deep mocks couple tests to internals; shallow mocks survive refactors.
- **Use `vi.mock(...)` over manual mocks.** Manual `__mocks__` folders are last-resort.
  - Why: inline mocks live next to the test; manual mocks are spooky-action-at-a-distance.
- **Don't mock `cube-core`.** It's pure functions and fast — use the real thing.
  - Why: mocking pure logic is cargo-culting. Real cube-core in tests catches real bugs in cube-core integration.

## Flake budget

- **Zero flaky tests on `main`.** A flake is treated as a failing test until quarantined or fixed.
  - Why: tolerated flakes train the team to ignore CI red, which is how real bugs get merged.
- **Quarantine via `it.skip` with a TODO including owner + date** (per code-style conventions). Quarantined tests get a follow-up issue.
  - Why: visible debt with a clock; not silent.
