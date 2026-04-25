export const PUZZLE_SLUGS = ['3x3'] as const

export type PuzzleSlug = (typeof PUZZLE_SLUGS)[number]

export const isPuzzleSlug = (value: string): value is PuzzleSlug =>
  (PUZZLE_SLUGS as readonly string[]).includes(value)
