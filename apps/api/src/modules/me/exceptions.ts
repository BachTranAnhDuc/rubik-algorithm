import { HttpException, HttpStatus } from '@nestjs/common'

const buildPayload = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : {}),
})

export class ChosenVariantInvalidException extends HttpException {
  constructor(chosenVariantId: string, caseId: string) {
    super(
      buildPayload(
        'chosen_variant_invalid',
        `Variant "${chosenVariantId}" does not belong to the requested case`,
        { chosenVariantId, caseId },
      ),
      HttpStatus.UNPROCESSABLE_ENTITY,
    )
  }
}

export class UserNotFoundException extends HttpException {
  constructor(userId: string) {
    super(
      buildPayload(
        'user_not_found',
        'Authenticated user no longer exists',
        { userId },
      ),
      HttpStatus.UNAUTHORIZED,
    )
  }
}
