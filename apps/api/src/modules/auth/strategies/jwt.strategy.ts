import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import type { AuthedUser } from '../../../common/types/authed-request'
import { ConfigService } from '../../../infra/config/config.service'

interface AccessTokenPayload {
  sub: string
  email: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    })
  }

  validate(payload: AccessTokenPayload): AuthedUser {
    return { id: payload.sub, email: payload.email }
  }
}
