export const METHOD_SLUGS = ['cfop'] as const

export type MethodSlug = (typeof METHOD_SLUGS)[number]

export const isMethodSlug = (value: string): value is MethodSlug =>
  (METHOD_SLUGS as readonly string[]).includes(value)
