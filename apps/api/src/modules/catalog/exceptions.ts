import { HttpException, HttpStatus } from '@nestjs/common'

const buildPayload = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  ...(details ? { details } : {}),
})

export class PuzzleNotFoundException extends HttpException {
  constructor(slug: string) {
    super(buildPayload('puzzle_not_found', `No puzzle found for slug "${slug}"`, { slug }), HttpStatus.NOT_FOUND)
  }
}

export class MethodNotFoundException extends HttpException {
  constructor(puzzleSlug: string, methodSlug: string) {
    super(
      buildPayload('method_not_found', `No method "${methodSlug}" under puzzle "${puzzleSlug}"`, {
        puzzleSlug,
        methodSlug,
      }),
      HttpStatus.NOT_FOUND,
    )
  }
}

export class SetNotFoundException extends HttpException {
  constructor(slug: string) {
    super(buildPayload('set_not_found', `No algorithm set found for slug "${slug}"`, { slug }), HttpStatus.NOT_FOUND)
  }
}

export class CaseNotFoundException extends HttpException {
  constructor(slug: string) {
    super(buildPayload('case_not_found', `No algorithm case found for slug "${slug}"`, { slug }), HttpStatus.NOT_FOUND)
  }
}
