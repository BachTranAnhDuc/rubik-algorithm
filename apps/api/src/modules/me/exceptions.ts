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
