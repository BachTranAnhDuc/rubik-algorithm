# Code Style Conventions

Shape-level rules: function shape, comments, naming, errors, async, magic numbers. The TypeScript rule (`000`) governs *what's legal*; this file governs *what reads best*. When they disagree, 000 wins.

## Function shape

- **Arrow functions everywhere**, including top-level exports:
  ```ts
  export const parseAlgorithm = (input: string): Move[] => { /* ... */ }
  export const Page = async ({ params }: PageProps) => {
    const { method } = await params
  }
  ```
  - Why: single rule, no "is this a top-level export or not?" judgment at every site. Modern engines set `Function.name` from the variable binding, so stack traces stay readable.
- **Vendored components are the exception.** Files under `apps/web/src/components/ui/` from `pnpm dlx shadcn@latest add` keep their upstream `function`-style — don't reshape them.
  - Why: matches upstream so `shadcn diff` (when it exists) still works; minimizes drift on regeneration.
- **NestJS uses class-style with decorators.** That's required by the framework; controllers and services stay classes.
  - Why: NestJS DI relies on class metadata; arrow-functioning a controller is a non-starter.

## Props and parameters

- **3+ *required* positional parameters → destructured opts object.** 1–2 required parameters stay positional.
  ```ts
  // positional (≤ 2 required)
  const clamp = (min: number, value: number) => Math.max(min, value)

  // opts (3+ required)
  const showToast = ({ title, description, variant }: {
    title: string
    description?: string
    variant: 'success' | 'error'
  }) => { /* ... */ }
  ```
  - Why: positional ordering stops being memorable past two required slots; named fields document intent at the call site for free.
- **Trailing-optional args stay positional.** A helper like `applyAlgorithm(state, alg, options?)` keeps its signature.
  - Why: trailing optionals are the language-level answer to "I only want to pass one thing most of the time."
- **Components AND utility functions follow the same threshold.**
  - Why: one rule, fewer exceptions.

## Comments

- **Default: no comments.** Well-named identifiers and small functions explain *what*; comments explain *why*.
  - Why: code is verified every compile. Comments rot silently.
- **Write a comment when the *why* is non-obvious** — a workaround for a known bug, a constraint from a spec, a surprising invariant, a value that looks wrong but isn't.
  ```ts
  // pgbouncer in transaction-mode breaks prepared statements; force direct URL for migrations.
  url = process.env.DIRECT_URL
  ```
  - Why: future-you can re-derive *what* from the code but not *why*.
- **JSDoc only on exported public-API functions that take an opts object.** Document each field when its purpose isn't self-evident from the name.
  - Why: the opts shape is the API surface; field-by-field docs earn their place when names underspecify.

### Banned comment patterns

- **AI-slop summaries** — `// This function handles X by doing Y`. If the function name doesn't say it, rename the function.
- **Dead code commented out.** Git remembers; delete it.
- **`TODO` / `FIXME` without owner + date.** Format: `// TODO(name, YYYY-MM-DD): reason`. A stale anonymous TODO is noise.
- **Step-by-step narration** — `// 1. fetch  // 2. validate  // 3. return`. If the steps need labels, extract named functions.
- **`// eslint-disable-*` without a reason comment on the line above.** Unexplained disables accrete forever.
- **Decorator/method docstrings restating the type.** `/** Returns Promise<User> */` next to `async findUser(): Promise<User>`. The signature is the docs.

Why: each is a specific, greppable anti-pattern that costs more than it pays. The rule is here so review can point at it with a file:line cite.

## Naming

- **Booleans start with `is` / `has` / `should`.** `isPrimary`, `hasRefreshToken`, `shouldAnimate`.
  - Why: reads as a question at the call site. Bare `primary` is ambiguous between a boolean state and an action.
- **Handlers: `handle*` local, `on*` as prop names.** Internal `handleClick`, prop `onClick`.
  - Why: matches React's own convention. Grep separates producers from consumers.
- **No `Async` suffix on async functions.** `loadUser`, not `loadUserAsync`.
  - Why: `async` keyword + `Promise<...>` return already signal it. The suffix is C#-flavored noise.
- **Constants in `SCREAMING_SNAKE_CASE` only when they're true module-level constants.** `EASE_OUT_EXPO`, `DEFAULT_DEBOUNCE_MS`. Local "constants" inside a function are camelCase.
  - Why: SCREAMING signals "module API"; using it for locals dilutes that signal.

## Error handling

- **Expected errors return a discriminated-union result on internal seams:**
  ```ts
  type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
  ```
  - Why: the failure mode is part of the type, not a runtime surprise; exhaustive handling falls out of the `switch`.
- **Programmer errors (invariant violations) throw.** Unreachable branches use `throw new Error('Unreachable: ...')`.
  - Why: throws signal "this is a bug, not a user-facing failure"; the dev loop sees them loud.
- **Don't use `try/catch` as control flow.** If you're catching to branch on a known case, convert the source to `Result` instead.
  - Why: exceptions are global jumps; `Result` keeps data flow local and greppable.
- **NestJS exceptions extend `HttpException` with stable codes.** `CaseNotFoundException extends HttpException` with code `case_not_found`.
  - Why: clients branch on `code`, not message text. Stable codes are the api contract.

## Async

- **Always `await`.** Never chain `.then()`.
  - Why: `await` keeps the call site linear; `.then` fragments scope and breaks `try/catch` semantics.
- **Don't mix `await` and `.then()` within a single function.**
  - Why: reading order becomes non-linear; errors route through two different machineries.
- **Parallelize independent promises with `Promise.all`.** Never `for…of` + `await` over an array of independent work.
  - Why: serial awaits add latency for no reason; `Promise.all` fans out.

## `const` vs `let`

- **`const` is the default.** Reach for `let` only when reassignment is the whole point — accumulators, retry loops, values mutated inside a branch.
  - Why: `const` narrows reader attention; `let` asks them to track mutation across the scope.
- **Never `var`.**
  - Why: hoisting and function-scoping bugs are a solved problem with `let` / `const`.

## Truthy checks

- **`if (x)` for presence checks** (null / undefined / empty object).
  - Why: covers the 95% case without ceremony.
- **Explicit comparisons when a falsy value carries meaning:**
  ```ts
  if (count === 0) { /* zero is real data */ }
  if (name === '') { /* empty string is a state */ }
  if (items.length === 0) { /* empty-but-present array */ }
  ```
  - Why: bare `if (count)` treats zero and absence identically — a latent bug for anything numeric.
- **Avoid `!!x` unless coercion is the goal.** Prefer `x != null` or `typeof x === 'string'` when you mean a specific check.
  - Why: `!!` conflates "present" with "truthy".

## Magic numbers

- **Extract to a named constant when used more than once OR when the meaning isn't self-evident.**
  ```ts
  const SCRAMBLE_LENGTH = 25
  const REFRESH_TOKEN_TTL_DAYS = 30
  const VISUALIZER_TWEEN_MS = 280
  ```
  - Why: grep-ability and single source of truth. `30` appearing in three files is indistinguishable from three coincidences; the name says "these are the same thing."
- **One-shot values in one place are fine.** `setTimeout(fn, 300)` for a single debounce isn't worth a constant.
  - Why: tokens are for reuse and meaning; solitary literals don't earn the ceremony.

## Code organization

- **Default to colocation.** Constants, types, and helpers live in the file that uses them. Graduate when they cross a boundary.
- **Graduate to a per-package `lib/` (or `common/`) when:**
  - Used across 2+ modules within the package.
  - Belongs to a known-volatile category (URLs, storage keys, event names, route paths, env-derived config, motion tokens).
  - Why: matches `070-code-organization-rule.md` of the user's portfolio. Same trigger model.
- **No barrel files (`index.ts`) inside `lib/` or `common/`.** Import from the specific topic file: `import { SCRAMBLE_LENGTH } from '@/lib/constants/scramble'`.
  - Why: barrels encourage `import * as X` which ruins grep — you can't locate a symbol from its usage. Also fuzzes tree-shaking.
- **One topic per file.** Topic-split files stay short and greppable; one-big-file grows into a dumping ground.
  - Why: cohesion. Splitting is cheaper than splitting later.
- **Empty folders don't get committed.** No `.gitkeep`. A folder appears when its first file lands.
  - Why: git doesn't track directories; placeholders are noise.
