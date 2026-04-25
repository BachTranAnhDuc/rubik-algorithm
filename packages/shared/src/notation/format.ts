import { normalizeNotation } from './normalize'

// Display formatting. Currently equivalent to normalize; reserved for future
// elaborations (Unicode primes, grouping, etc.) that should not affect storage.
export const formatNotation = (notation: string): string => normalizeNotation(notation)
