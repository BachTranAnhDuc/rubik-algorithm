'use client'

import { useCommandPalette } from '@/features/command-palette/store'

export const CommandPaletteTrigger = () => {
  const setOpen = useCommandPalette((s) => s.setOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="hidden items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-accent sm:flex"
      aria-label="Open command palette"
    >
      Search
      <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  )
}
