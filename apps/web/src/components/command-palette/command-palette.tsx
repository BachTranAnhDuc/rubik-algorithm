'use client'

import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useCommandPalette } from '@/features/command-palette/store'
import { useSearch } from '@/features/search/use-search'

import { useKeyboardShortcut } from './use-keyboard-shortcut'

const SEARCH_DEBOUNCE_MS = 200

export const CommandPalette = () => {
  const router = useRouter()
  const { open, setOpen, toggle } = useCommandPalette()
  const { data: session } = useSession()
  const { setTheme, theme } = useTheme()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useKeyboardShortcut('k', toggle)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const { data: results } = useSearch(debounced, 10)

  const navigate = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href as Route)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type to search or run a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {results && results.hits.length > 0 ? (
          <>
            <CommandGroup heading="Cases">
              {results.hits.map((h) => (
                <CommandItem
                  key={h.caseId}
                  value={`${h.caseName} ${h.methodSlug} ${h.setSlug}`}
                  onSelect={() =>
                    navigate(
                      `/${h.puzzleSlug}/${h.methodSlug}/${h.setSlug}/${h.caseSlug}`,
                    )
                  }
                >
                  <span className="font-medium">{h.caseName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {h.methodSlug} / {h.setSlug}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        <CommandGroup heading="Navigation">
          <CommandItem value="Browse catalog" onSelect={() => navigate('/3x3')}>
            Browse catalog
          </CommandItem>
          {session ? (
            <CommandItem
              value="My algorithms"
              onSelect={() => navigate('/me/algorithms')}
            >
              My algorithms
            </CommandItem>
          ) : null}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            value="Toggle theme dark light"
            onSelect={() => {
              setOpen(false)
              setTheme(theme === 'dark' ? 'light' : 'dark')
            }}
          >
            Toggle theme
          </CommandItem>
          {session ? (
            <CommandItem
              value="Sign out"
              onSelect={() => navigate('/api/auth/signout')}
            >
              Sign out
            </CommandItem>
          ) : (
            <CommandItem value="Sign in" onSelect={() => navigate('/login')}>
              Sign in
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
