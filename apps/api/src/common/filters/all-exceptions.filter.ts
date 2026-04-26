import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import { ZodError } from 'zod'

import type { ErrorResponse } from '../dtos/error.dto'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { id?: string }>()

    const { status, body } = this.toResponse(exception)
    if (request.id) body.requestId = request.id

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, requestId: request.id, path: request.url },
        body.error.message,
      )
    }

    response.status(status).json(body)
  }

  private toResponse(exception: unknown): {
    status: number
    body: ErrorResponse
  } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: {
            code: 'validation_error',
            message: 'Request validation failed',
            details: exception.issues,
          },
        },
      }
    }

    if (exception instanceof ZodValidationException) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: {
            code: 'validation_error',
            message: 'Request validation failed',
            details: exception.getZodError().issues,
          },
        },
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const res = exception.getResponse()
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string }).message ?? exception.message)
      const code =
        typeof res === 'object' && res !== null && 'code' in res
          ? String((res as { code: unknown }).code)
          : exception.name
              .replace(/Exception$/, '')
              .replace(/([a-z])([A-Z])/g, '$1_$2')
              .toLowerCase()
      const details =
        typeof res === 'object' && res !== null && 'details' in res
          ? (res as { details: unknown }).details
          : undefined

      return {
        status,
        body: { error: { code, message, ...(details !== undefined ? { details } : {}) } },
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'internal_error',
          message: 'An unexpected error occurred',
        },
      },
    }
  }
}
