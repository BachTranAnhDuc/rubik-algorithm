import { Button } from '@/components/ui/button'

import { serverSignOut } from './sign-out-action'

export const SignOutButton = () => (
  <form action={serverSignOut}>
    <Button variant="outline" type="submit">
      Sign out
    </Button>
  </form>
)
