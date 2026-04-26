import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VariantList } from '@/components/algorithm/variant-list'
import { CubeStateDiagram } from '@/components/cube/cube-state-diagram'
import {
  getCaseWithVariants,
  getMethods,
  getSets,
  getSetWithCases,
} from '@/features/catalog/catalog-fetchers'
import type { ApiError } from '@/lib/api-client'
import { Markdown } from '@/lib/markdown'

export const revalidate = 600

const PUZZLE_SLUG = '3x3'

export const generateStaticParams = async () => {
  const methods = await getMethods(PUZZLE_SLUG)
  const perMethod = await Promise.all(
    methods.map(async (m) => {
      const sets = await getSets(PUZZLE_SLUG, m.slug)
      const perSet = await Promise.all(
        sets.map(async (s) => {
          const setData = await getSetWithCases(s.slug)
          return setData.cases.map((c) => ({
            method: m.slug,
            set: s.slug,
            case: c.slug,
          }))
        }),
      )
      return perSet.flat()
    }),
  )
  return perMethod.flat()
}

interface PageProps {
  params: Promise<{ method: string; set: string; case: string }>
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
  const { case: caseSlug } = await params
  try {
    const c = await getCaseWithVariants(caseSlug)
    return {
      title: `${c.displayName} — rubik-algorithm`,
      description: c.recognitionMd?.slice(0, 160) ?? `${c.displayName} algorithm and recognition.`,
    }
  } catch {
    return { title: 'Case not found — rubik-algorithm' }
  }
}

const HERO_SIZE = 320

export default async function CasePage({ params }: PageProps) {
  const { method, set, case: caseSlug } = await params

  let caseData
  let setData
  try {
    ;[caseData, setData] = await Promise.all([
      getCaseWithVariants(caseSlug),
      getSetWithCases(set),
    ])
  } catch (err) {
    if ((err as ApiError).status === 404) notFound()
    throw err
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href={`/${PUZZLE_SLUG}` as Route} className="hover:underline">
          3x3
        </Link>
        {' / '}
        <Link
          href={`/${PUZZLE_SLUG}/${method}` as Route}
          className="hover:underline capitalize"
        >
          {method}
        </Link>
        {' / '}
        <Link
          href={`/${PUZZLE_SLUG}/${method}/${set}` as Route}
          className="hover:underline"
        >
          {setData.name}
        </Link>
        {' / '}
        <span className="font-medium text-foreground">{caseData.displayName}</span>
      </nav>

      <h1 className="mb-8 text-4xl font-bold">{caseData.displayName}</h1>

      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
        <div className="shrink-0">
          <CubeStateDiagram
            caseState={caseData.caseState}
            recognitionBasis={setData.recognitionBasis}
            size={HERO_SIZE}
            title={caseData.displayName}
          />
        </div>
        <div className="flex-1">
          {caseData.recognitionMd ? (
            <section>
              <h2 className="mb-2 text-xl font-semibold">Recognition</h2>
              <Markdown source={caseData.recognitionMd} />
            </section>
          ) : null}
          {caseData.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {caseData.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold">Variants</h2>
        <VariantList variants={caseData.variants} />
      </section>
    </main>
  )
}
