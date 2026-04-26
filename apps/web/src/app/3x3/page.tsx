import type { Metadata } from 'next'

import { MethodCard } from '@/components/algorithm/method-card'
import { getMethods } from '@/features/catalog/catalog-fetchers'

export const revalidate = 600

export const metadata: Metadata = {
  title: '3x3 — rubik-algorithm',
  description: 'CFOP and other methods for the 3x3 cube.',
}

const PUZZLE_SLUG = '3x3'

export default async function PuzzlePage() {
  const methods = await getMethods(PUZZLE_SLUG)
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">3x3 — Methods</h1>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {methods.map((m) => (
          <MethodCard key={m.slug} method={m} puzzleSlug={PUZZLE_SLUG} />
        ))}
      </ul>
    </main>
  )
}
