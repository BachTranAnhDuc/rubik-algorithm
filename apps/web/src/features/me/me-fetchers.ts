import 'server-only'

import { UserAlgorithmSchema, type UserAlgorithm } from '@rubik/shared'
import { z } from 'zod'

import { apiFetch } from '@/lib/api-client'

const UserAlgorithmsSchema = z.array(UserAlgorithmSchema)

export const getMyAlgorithms = (accessToken: string): Promise<UserAlgorithm[]> =>
  apiFetch('/v1/me/algorithms', UserAlgorithmsSchema, { accessToken })
