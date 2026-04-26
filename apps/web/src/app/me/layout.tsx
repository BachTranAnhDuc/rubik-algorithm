import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { auth } from '@/lib/auth/auth.config'

export default async function MeLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.apiAccessToken) {
    redirect('/login?next=/me/algorithms')
  }
  return <>{children}</>
}
