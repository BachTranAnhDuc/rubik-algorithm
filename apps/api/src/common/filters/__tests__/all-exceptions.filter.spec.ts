import { type ArgumentsHost, HttpStatus } from '@nestjs/common'
import { ZodValidationException } from 'nestjs-zod'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { AllExceptionsFilter } from '../all-exceptions.filter'

const buildHost = () => {
  const status = vi.fn().mockReturnThis()
  const json = vi.fn().mockReturnThis()
  const response = { status, json }
  const request = { id: 'req-1', url: '/v1/test' }
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost,
    response,
  }
}

describe('AllExceptionsFilter', () => {
  it('unwraps ZodValidationException to 422 validation_error with details', () => {
    const filter = new AllExceptionsFilter()
    const { host, response } = buildHost()

    const parsed = z.object({ idToken: z.string().min(1) }).safeParse({})
    if (parsed.success) throw new Error('expected zod parse to fail')
    const exception = new ZodValidationException(parsed.error)

    filter.catch(exception, host)

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY)
    const body = response.json.mock.calls[0]?.[0] as {
      error: { code: string; details: unknown }
      requestId: string
    }
    expect(body.error.code).toBe('validation_error')
    expect(Array.isArray(body.error.details)).toBe(true)
    expect((body.error.details as unknown[]).length).toBeGreaterThan(0)
    expect(body.requestId).toBe('req-1')
  })
})
