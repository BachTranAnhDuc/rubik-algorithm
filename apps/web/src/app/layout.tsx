import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

import { CommandPalette } from '@/components/command-palette/command-palette'
import { SiteHeader } from '@/components/layout/site-header'
import { RootProviders } from '@/providers/root-providers'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'rubik-algorithm',
  description: 'A learnable, searchable, trackable algorithm corpus for the speedcubing community.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <RootProviders>
          <SiteHeader />
          {children}
          <CommandPalette />
          <Toaster richColors position="top-right" />
        </RootProviders>
      </body>
    </html>
  )
}
