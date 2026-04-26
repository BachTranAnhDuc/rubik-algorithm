import { HttpException, HttpStatus } from '@nestjs/common'

const buildPayload = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : {}),
})

export class InvalidGoogleTokenException extends HttpException {
  constructor(reason?: string) {
    super(
      buildPayload(
        'invalid_google_token',
        'Google ID token failed verification',
        reason ? { reason } : undefined,
      ),
      HttpStatus.UNAUTHORIZED,
    )
  }
}

export class InvalidRefreshTokenException extends HttpException {
  constructor() {
    super(
      buildPayload('invalid_refresh_token', 'Refresh token is invalid or revoked'),
      HttpStatus.UNAUTHORIZED,
    )
  }
}

export class RefreshExpiredException extends HttpException {
  constructor() {
    super(
      buildPayload('refresh_expired', 'Refresh token has expired'),
      HttpStatus.UNAUTHORIZED,
    )
  }
}
