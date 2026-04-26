import { redirect } from 'next/navigation'

import { SignInButton } from '@/features/auth/sign-in-button'
import { getCurrentUser } from '@/lib/auth/session'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Sign in to rubik-algorithm</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Sign in to track which algorithms you&apos;re learning, save your preferred variants, and
        sync your progress across devices.
      </p>
      <SignInButton />
    </main>
  )
}
