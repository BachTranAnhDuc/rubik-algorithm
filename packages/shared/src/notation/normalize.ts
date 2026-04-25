import { tokenizeNotation } from './tokens'

// Canonicalize a notation string for storage: trim, single-space separation,
// preserve case (face moves are case-sensitive in WCA notation).
export const normalizeNotation = (notation: string): string =>
  tokenizeNotation(notation).join(' ')
