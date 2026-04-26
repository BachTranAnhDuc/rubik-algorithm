import { Injectable } from '@nestjs/common'
import { OAuth2Client, type TokenPayload } from 'google-auth-library'

import { ConfigService } from '../../../infra/config/config.service'
import { InvalidGoogleTokenException } from '../exceptions'

export interface GoogleProfile {
  sub: string
  email: string
  name?: string
  picture?: string
}

@Injectable()
export class GoogleVerifierService {
  private readonly client: OAuth2Client
  private readonly audience: string

  constructor(private readonly config: ConfigService) {
    // env.schema's .refine guarantees GOOGLE_CLIENT_ID is set outside NODE_ENV=test,
    // so the '' fallback only fires under test. google-auth-library's verifyIdToken
    // still enforces audience match in oauth2client.js — every real payload's `aud`
    // is a non-empty Google client ID, so `aud !== ''` rejects every token.
    // Fail-closed, not bypass: do NOT "clean up" to `?? undefined`, which would
    // disable audience validation entirely and silently regress security.
    this.audience = this.config.get('GOOGLE_CLIENT_ID') ?? ''
    this.client = new OAuth2Client(this.audience)
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    let payload: TokenPayload | undefined
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audience })
      payload = ticket.getPayload()
    } catch (err) {
      throw new InvalidGoogleTokenException(err instanceof Error ? err.message : undefined)
    }
    if (!payload?.sub || !payload.email) {
      throw new InvalidGoogleTokenException('payload missing sub or email')
    }
    return {
      sub: payload.sub,
      email: payload.email,
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.picture !== undefined ? { picture: payload.picture } : {}),
    }
  }
}
