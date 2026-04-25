export const SET_SLUGS = ['f2l', 'oll', 'pll'] as const

export type SetSlug = (typeof SET_SLUGS)[number]

export const isSetSlug = (value: string): value is SetSlug =>
  (SET_SLUGS as readonly string[]).includes(value)
