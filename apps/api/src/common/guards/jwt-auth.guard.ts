import { type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

// TODO(ducbach, 2026-04-26): wire as APP_GUARD in app.module.ts when AuthModule lands (sub-phase 4 of plan 05).
// Until then, IS_PUBLIC_KEY metadata set by @Public() / @PublicCacheable() is inert at runtime.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (isPublic) return true
    return super.canActivate(context)
  }
}
