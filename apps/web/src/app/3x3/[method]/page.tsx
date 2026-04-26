import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SetCard } from '@/components/algorithm/set-card'
import { getMethods, getSets } from '@/features/catalog/catalog-fetchers'
import type { ApiError } from '@/lib/api-client'

export const revalidate = 600

const PUZZLE_SLUG = '3x3'

export const generateStaticParams = async () => {
  const methods = await getMethods(PUZZLE_SLUG)
  return methods.map((m) => ({ method: m.slug }))
}

interface PageProps {
  params: Promise<{ method: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { method } = await params
  return {
    title: `${method.toUpperCase()} — 3x3 — rubik-algorithm`,
    description: `${method.toUpperCase()} method on the 3x3 cube.`,
  }
}

export default async function MethodPage({ params }: PageProps) {
  const { method } = await params
  let sets
  try {
    sets = await getSets(PUZZLE_SLUG, method)
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold capitalize">{method}</h1>
      <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {sets.map((s) => (
          <SetCard
            key={s.slug}
            set={s}
            puzzleSlug={PUZZLE_SLUG}
            methodSlug={method}
          />
        ))}
      </ul>
    </main>
  )
}
