# Plan 06 — Initial content

**Depends on:** 02 (`shared` schemas), 03 (`cube-core` for notation correctness), 05 (`api` seed pipeline).
**Produces:** enough YAML in `content/` to render real algorithm pages and exercise the seed pipeline end-to-end.
**Reference:** §22.

## Goal

Validate the YAML → DB pipeline against real (small) content. Full 119-case CFOP corpus is a separate, ongoing authoring task that does not block v1 platform readiness.

## Deliverables

```
content/
├── puzzles/3x3/
│   ├── puzzle.yaml
│   └── methods/cfop/
│       ├── method.yaml
│       └── sets/
│           ├── f2l/{set.yaml, cases/<3 cases>.yaml}
│           ├── oll/{set.yaml, cases/<3 cases>.yaml}
│           └── pll/{set.yaml, cases/<3 cases>.yaml}
└── fixtures/
    └── puzzles/3x3/methods/cfop/sets/{f2l,oll,pll}/{set.yaml, cases/<2 cases>.yaml}
```

**Initial scope:** 3 cases per set with primary variants only (≈9 case files). PLL must include T-Perm and at least one A-Perm (used in tests). Fixtures ≤2 cases per set, kept minimal for fast tests.

## Steps

1. Author `puzzle.yaml`, `method.yaml`, three `set.yaml` files per §22.2.
2. Author each case YAML — verify `case_state` is exactly 54 chars and the primary `notation` correctly solves it.
3. Run `make content.validate`. Fix any failures (likely: notation/`case_state` mismatch — that's the validator working).
4. Run `make db.seed`. Verify rows in Prisma Studio.
5. `curl http://localhost:3001/v1/sets/pll` returns the seeded set with cases and variants.
6. Mirror a tiny subset under `content/fixtures/` for use by api integration tests and web component tests (Plans 05 + 07).

## Done when

- [ ] `make content.validate` passes with no errors.
- [ ] `make db.seed` is idempotent — running twice produces identical DB state.
- [ ] `make content.validate` fails fast and clearly when a deliberately-broken alg is introduced (regression-test the validator itself).
- [ ] Api integration tests can run against fixtures without depending on full content.
- [ ] At least 9 cases visible across F2L/OLL/PLL.

## Out of scope

- Full 119-case corpus — separate authoring backlog.
- Recognition images / rich `recognition_md` — minimal versions in v1; richer copy in a later content pass.
- Localization, media assets — deferred (§22.7).
