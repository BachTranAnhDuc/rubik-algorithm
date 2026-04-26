import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { SearchInput } from '@/components/search/search-input'
import { getSearchResults } from '@/features/search/search-fetchers'

export const metadata: Metadata = {
  title: 'Search — rubik-algorithm',
  description: 'Search the algorithm corpus by name, set, or notation.',
}

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

const Results = async ({ q }: { q: string }) => {
  if (!q.trim()) {
    return (
      <p className="mt-8 text-muted-foreground">
        Type a case name, set, or notation.
      </p>
    )
  }
  let result
  try {
    result = await getSearchResults(q, 20)
  } catch {
    return (
      <p className="mt-8 text-muted-foreground">
        Search is briefly unavailable.
      </p>
    )
  }
  if (result.hits.length === 0) {
    return (
      <p className="mt-8 text-muted-foreground">
        No matches. Try fewer characters.
      </p>
    )
  }
  return (
    <ul className="mt-8 space-y-2">
      {result.hits.map((hit) => (
        <li key={hit.caseId}>
          <Link
            href={`/${hit.puzzleSlug}/${hit.methodSlug}/${hit.setSlug}/${hit.caseSlug}` as Route}
            className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
          >
            <div className="text-base font-semibold">{hit.caseName}</div>
            <div className="text-sm text-muted-foreground">
              {hit.puzzleSlug} / {hit.methodSlug} / {hit.setSlug}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Search</h1>
      <SearchInput />
      <Suspense
        key={q}
        fallback={<p className="mt-8 text-muted-foreground">Searching...</p>}
      >
        <Results q={q} />
      </Suspense>
    </main>
  )
}
