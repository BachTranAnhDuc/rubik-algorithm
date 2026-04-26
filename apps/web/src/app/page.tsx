import Link from 'next/link'

import { getCurrentUser } from '@/lib/auth/session'

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">rubik-algorithm</h1>
      {user ? (
        <p className="max-w-md text-center text-xl">
          Welcome back. Browse the{' '}
          <Link href="/3x3" className="text-primary underline-offset-4 hover:underline">
            CFOP catalog
          </Link>{' '}
          to track what you&apos;re learning.
        </p>
      ) : (
        <p className="max-w-md text-center text-muted-foreground">
          The CFOP algorithm corpus, learnable and trackable.
        </p>
      )}
    </main>
  )
}
