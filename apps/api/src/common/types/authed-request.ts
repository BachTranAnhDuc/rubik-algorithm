import type { Request } from 'express'

export interface AuthedUser {
  id: string
  email: string
}

export interface AuthedRequest extends Request {
  user: AuthedUser
}
