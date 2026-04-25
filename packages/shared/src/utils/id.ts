import { z } from 'zod'

// Permissive across cuid, cuid2, uuid, nanoid: alphanumeric, hyphen, underscore.
export const ID_REGEX = /^[A-Za-z0-9_-]+$/

export const IdSchema = z.string().min(1).regex(ID_REGEX, 'must be a valid id token')

export const isId = (value: string): boolean => value.length > 0 && ID_REGEX.test(value)
