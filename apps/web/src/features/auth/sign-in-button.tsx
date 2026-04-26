'use client'

import { signIn } from 'next-auth/react'

import { Button } from '@/components/ui/button'

interface SignInButtonProps {
  callbackUrl?: string
}

export const SignInButton = ({ callbackUrl = '/' }: SignInButtonProps) => (
  <Button onClick={() => signIn('google', { callbackUrl })}>Sign in with Google</Button>
)
