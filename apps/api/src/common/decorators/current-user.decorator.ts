import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthedRequest, AuthedUser } from '../types/authed-request'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>()
    return request.user
  },
)
