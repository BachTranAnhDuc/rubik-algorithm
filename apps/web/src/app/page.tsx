import { Button } from '@/components/ui/button'
import { SignInButton } from '@/features/auth/sign-in-button'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { getCurrentUser } from '@/lib/auth/session'

export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">rubik-algorithm</h1>
      {user ? (
        <>
          <p className="text-xl">
            Welcome, <span className="font-semibold">{user.displayName ?? user.email}</span>
          </p>
          <SignOutButton />
        </>
      ) : (
        <>
          <p className="max-w-md text-center text-muted-foreground">
            The CFOP algorithm corpus, learnable and trackable.
          </p>
          <SignInButton />
          <Button variant="link" asChild>
            <a href="/login">Or visit /login directly</a>
          </Button>
        </>
      )}
    </main>
  )
}
