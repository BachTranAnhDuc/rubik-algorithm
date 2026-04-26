import type { ReactNode } from 'react'

import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

export const RootProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <QueryProvider>{children}</QueryProvider>
  </ThemeProvider>
)
