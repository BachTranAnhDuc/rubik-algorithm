import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AlgorithmsTable } from '@/components/me/algorithms-table'
import { getAllCases } from '@/features/catalog/catalog-fetchers'
import { getMyAlgorithms } from '@/features/me/me-fetchers'
import { meKeys } from '@/features/me/query-keys'
import { auth } from '@/lib/auth/auth.config'

export const metadata: Metadata = {
  title: 'My algorithms — rubik-algorithm',
  description: 'Track which algorithms you are learning, learned, and mastered.',
}

export default async function MyAlgorithmsPage() {
  const session = await auth()
  const token = session?.apiAccessToken
  if (!token) redirect('/login?next=/me/algorithms')

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: meKeys.algorithms,
    queryFn: () => getMyAlgorithms(token),
  })

  const allCases = await getAllCases()
  const casesById = Object.fromEntries(allCases.map((c) => [c.case.id, c]))

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">My algorithms</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AlgorithmsTable casesById={casesById} />
      </HydrationBoundary>
    </main>
  )
}
