import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CaseGrid } from '@/components/algorithm/case-grid'
import {
  getMethods,
  getSets,
  getSetWithCases,
} from '@/features/catalog/catalog-fetchers'
import type { ApiError } from '@/lib/api-client'

export const revalidate = 600

const PUZZLE_SLUG = '3x3'

export const generateStaticParams = async () => {
  const methods = await getMethods(PUZZLE_SLUG)
  const perMethod = await Promise.all(
    methods.map(async (m) => {
      const sets = await getSets(PUZZLE_SLUG, m.slug)
      return sets.map((s) => ({ method: m.slug, set: s.slug }))
    }),
  )
  return perMethod.flat()
}

interface PageProps {
  params: Promise<{ method: string; set: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { method, set } = await params
  return {
    title: `${set.toUpperCase()} — ${method.toUpperCase()} — rubik-algorithm`,
    description: `Algorithms for the ${set.toUpperCase()} set in the ${method.toUpperCase()} method.`,
  }
}

export default async function SetPage({ params }: PageProps) {
  const { method, set } = await params
  let setData
  try {
    setData = await getSetWithCases(set)
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">{setData.name}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {setData.cases.length} of {setData.caseCountExpected} cases
      </p>
      <CaseGrid
        cases={setData.cases}
        recognitionBasis={setData.recognitionBasis}
        puzzleSlug={PUZZLE_SLUG}
        methodSlug={method}
        setSlug={set}
      />
    </main>
  )
}
