import Link from 'next/link'

import { SignInButton } from '@/features/auth/sign-in-button'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { getCurrentUser } from '@/lib/auth/session'

export const SiteHeader = async () => {
  const user = await getCurrentUser()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold">
          rubik-algorithm
        </Link>
        <nav className="flex items-center gap-6">
          <a href="/3x3" className="text-sm font-medium hover:underline">
            Catalog
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.displayName ?? user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  )
}
