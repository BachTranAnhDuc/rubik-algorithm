# MCP Server Conventions

When to reach for an MCP server vs. the built-in tools, and which MCP wins when several fit. This project's `.mcp.json` registers a small set; this file pins how to use them.

## Default: built-ins first

- **Read / Glob / Grep / Bash are the primary tools.** Use them for single-file reads, edits, content search, and shell ops.
  - Why: built-ins enforce read-before-edit, run ripgrep under Grep, respect `.gitignore`, and have zero MCP round-trip latency. Proxying a Read through an MCP loses those guardrails.
- **WebFetch and WebSearch are the default research pair.** Known URL → WebFetch; open-ended topic → WebSearch.
  - Why: no MCP improves on either for general research. Library docs are the one exception — see context7 below.

## Filesystem MCP: built-ins first, MCP for batch ops

Registered in `.mcp.json`. Roots: `/home/ducbach/Documents/study/rubik-algorithm` and `/home/ducbach/Documents/study/portfolio`.

- **Stay on built-ins for single-file Read/Edit/Write and content search.** filesystem MCP is not the default.
  - Why: see "Default" — native path, guardrails, no latency.
- **Use filesystem MCP only for the ops the built-ins can't do cleanly:**
  - `read_multiple_files` — batch reads of a known file list.
  - `directory_tree` — visualize an unfamiliar subtree.
  - `search_files` — find files by name pattern (complements Glob when the pattern is awkward).
  - `move_file` — rename/move without shelling out.
  - Why: these are the genuine wins. Everything else is parity at higher cost.
- **Cross-repo lookups** — the portfolio root is registered for parity reads (e.g., comparing rule conventions). Don't write into the portfolio repo.
  - Why: that's a different project. Edits there belong to its own PRs.
- **Never use filesystem MCP to read a file you're about to Edit.** Edit still requires a prior Read via the built-in tool.
  - Why: the Edit tool tracks reads done by the built-in Read; an MCP-only read fails validation.

## Postgres MCP: read-only debugging

Registered in `.mcp.json`. Connection string is a placeholder — point it at the local Compose Postgres for development.

- **Use it for ad-hoc queries during development:** "what's in this table after the seed?", "did the FTS index get created?", "list all PLLs by display order".
  - Why: faster than opening Prisma Studio for one-off queries; gives you SQL-level access without leaving the agent.
- **Do not use it to mutate data.** Inserts, updates, deletes go through Prisma + migrations + seed.
  - Why: ad-hoc DB writes diverge from the schema-as-code model. Drift is invisible until the next migration tries to apply.
- **Don't run it against prod.** Prod creds never live in `.mcp.json`.
  - Why: an MCP with prod write access is a foot-gun aimed at the foot.

## Browser MCPs: scripted vs. inspection

Two browser MCPs registered: `playwright-server` (official `@playwright/mcp`) and `executeautomation-playwright-server` (community).

- **Use `playwright-server` for authoring + running scripted user flows** — multi-step journeys, codegen sessions, form fills, e2e style work.
  - Why: it's the official one; aligns with Playwright's built-in test runner.
- **Use `executeautomation-playwright-server`'s `playwright_*` actions for ad-hoc inspection or codegen sessions** when you want session-managed recording.
  - Why: the community server has codegen-session helpers (`start_codegen_session`, `end_codegen_session`) that make recording flows easier.
- **Don't cross the streams.** If you're scripting with one, finish with that one.
  - Why: each MCP's API shape and state are distinct. Mixing produces stale-context bugs.

## Research and docs

Priority order for any "find out about X":

1. **Library / framework / SDK docs → context7 MCP** (when configured). Triggers: React, Next.js, NestJS, Prisma, TanStack Query/Table, three.js, Tailwind, shadcn, zod, vitest — anything with its own docs site. Use even when training data seems sufficient.
   - Why: context7 serves current docs; training data lags behind release cycles.
2. **Open-ended exploration → WebSearch (built-in).**
   - Why: no MCP equivalent.
3. **Known URL → WebFetch (built-in).**
   - Why: native tool with AI post-processing; fine for the common case.

## MCPs not used by this project

Any global MCPs configured outside this repo (Crypto.com, Gmail, Calendar, Drive, Mermaid Chart, Excalidraw, Figma): ignore unless the user explicitly invokes them. They are configured globally, not for this repo.

- Why: scanning every MCP every turn wastes attention; explicit opt-in keeps defaults tight.

## Adding a new MCP

When the project genuinely needs a new MCP (e.g., a Linear/Sentry MCP for incident triage), add it via:

1. Update `.mcp.json` with the server config.
2. Document the trigger and "wins for which task" in this file (a new H2 section).
3. Cross-link from any relevant rule (e.g., adding a Sentry MCP gets a mention in `030-nestjs-rule.md` under observability).

- Why: an unannounced MCP is invisible; a documented one is a tool the team actually uses.
