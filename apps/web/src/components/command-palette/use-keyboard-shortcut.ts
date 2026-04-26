'use client'

import { useEffect } from 'react'

export const useKeyboardShortcut = (key: string, callback: () => void) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey
      if (isModifier && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        callback()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback])
}
