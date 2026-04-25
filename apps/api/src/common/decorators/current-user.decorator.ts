import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { CurrentUser as CurrentUserType } from '../types/current-user'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserType | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserType }>()
    return request.user
  },
)
