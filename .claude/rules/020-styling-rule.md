# Styling Conventions

`apps/web` uses Tailwind CSS v4 (CSS-first) and shadcn/ui copy-in components. `apps/docs` uses VitePress's default theme. The visualizer owns its own sticker color tokens.

## Tailwind v4

- **Configure in CSS, not `tailwind.config.ts`.** All tokens live in `apps/web/src/app/globals.css` under `@theme inline { ... }`. There is no JS config.
  - Why: Tailwind v4 ships a CSS-first engine; the JS config is legacy. `components.json` points `tailwind.config: ""` on purpose.
- **Add tokens to `@theme inline`, not arbitrary values.** If a value repeats more than twice, mint a CSS variable.
  - Why: tokens compose with variants (dark/light) and survive future palette work; magic values rot.
- **Use CSS variables (`var(--x)`) from Tailwind classes when a named token doesn't exist.** Pattern: `text-[length:var(--text-display)]`.
  - Why: keeps the class inline-readable while pointing at the single place the value is defined.

## Tokens & theming

- **Reference semantic tokens, not raw colors.** Use `bg-background`, `text-foreground`, `text-primary`, `border-border`. Only drop to `oklch(...)` inside `globals.css`.
  - Why: the dark/light modes flip these tokens; raw colors wouldn't respond.
- **Mode lives on `<html class="dark">`.** Don't write `dark:` without understanding the `@custom-variant dark (&:is(.dark *))` pattern.
  - Why: this variant means "any descendant of `.dark`", not `prefers-color-scheme`. The provider swaps the class explicitly.
- **Don't hard-code `bg-white` / `bg-black` / `text-zinc-*`.** Use semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`).
  - Why: hard-coded colors break one of the two modes immediately.

## shadcn/ui

- **Add components via `pnpm dlx shadcn@latest add <name>`.** They land in `apps/web/src/components/ui/` and are yours to edit.
  - Why: shadcn ships source, not a library — local edits are the expected workflow (§19.1).
- **Don't reinstall a component to "reset" it.** If you've customized, treat it as your code; if you need upstream features, cherry-pick.
  - Why: blind reinstall loses your customizations and creates churn.
- **Icons from `lucide-react`** — shadcn's default. Don't mix icon sources on the same surface.
  - Why: `components.json` declares `iconLibrary: "lucide"`; mixed sources look visually off.
- **Toasts via `sonner`** (the shadcn-recommended wrapper). One `<Toaster />` mounted at the root layout.
  - Why: avoids competing toast stacks; sonner's API is what shadcn examples assume.
- **Forms use shadcn's `<Form>` (built on react-hook-form).** Wire zod schemas via `@hookform/resolvers/zod`.
  - Why: shadcn's `<FormField>` / `<FormControl>` already handle aria-invalid, error rendering, and label wiring.
- **Tables use shadcn's `<Table>` skin around `@tanstack/react-table`.** The reusable wrapper lives at `apps/web/src/components/data-table/`.
  - Why: TanStack is headless — you bring the skin. shadcn has a documented integration; we use it (§19.1).

## Tailwind authoring style

- **`prettier-plugin-tailwindcss` orders classes.** Don't hand-order.
  - Why: zero diff noise; review focuses on intent.
- **Compose utilities; don't reach for `@apply`.**
  - Why: `@apply` builds a parallel invisible class system and negates `tailwind-merge`. Use it only for pseudo-element hacks in `globals.css`.
- **Arbitrary values (`[5.5rem]`, `[oklch(...)]`) are a last resort.** Repeat = mint a token.
  - Why: arbitrary values are unscannable — you can't grep a token if it's inlined as a literal.
- **Mobile-first.** Use `sm:`, `md:`, `lg:` to add, not override. Base classes describe the phone layout.
  - Why: flipping halfway creates breakpoint-salad.
- **Interactive states:** `hover:`, `focus-visible:`, `active:`, `disabled:`. Prefer `focus-visible:` over `focus:` for keyboard.
  - Why: bare `:focus` shows outlines for mouse clicks too — ugly.

## Class merging & variants

- **Always merge caller `className` via `cn()`.** Never `className="... " + className`.
  - Why: Tailwind's last-write-wins needs `tailwind-merge` to resolve conflicts across utility groups.
- **`cva` handles variant → class mapping.** Variant classes go in `variants`, stable classes in the base arg. Pull prop types from `VariantProps<typeof x>`.
  - Why: variant prop types for free; duplicates caught at build.

## Visualizer color tokens

- **The visualizer owns its sticker palette** in `packages/visualizer/src/tokens/colors.ts`. Import from there; don't redeclare.
  - Why: sticker colors are domain tokens (white/yellow/red/orange/blue/green per the standard 3x3 color scheme); they're not theme colors and don't flip with mode.
- **Don't pass Tailwind classes through to the three.js scene.** Tailwind classes don't work on three.js materials.
  - Why: Tailwind targets DOM. The renderer reads from the token map directly.
