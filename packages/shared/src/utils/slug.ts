import { z } from 'zod'

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const SlugSchema = z.string().regex(SLUG_REGEX, 'must be kebab-case (a-z, 0-9, hyphens)')

export const isSlug = (value: string): boolean => SLUG_REGEX.test(value)

export const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
