'use client'

import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 300

export const SearchInput = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = searchParams.get('q') ?? ''
  const [value, setValue] = useState(initial)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (value.trim()) {
        next.set('q', value)
      } else {
        next.delete('q')
      }
      router.replace(`/search?${next.toString()}` as Route)
    }, DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [value, router, searchParams])

  return (
    <input
      type="search"
      placeholder="Search cases by name, set, or notation..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
      autoFocus
    />
  )
}
