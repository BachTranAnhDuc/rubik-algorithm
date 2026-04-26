import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

import type { AuthedUser } from '../types/authed-request'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const request = http.getRequest<
      Request & { id?: string; user?: AuthedUser }
    >()
    const response = http.getResponse<Response>()
    const start = Date.now()

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, start),
        error: () => this.log(request, response, start),
      }),
    )
  }

  private log(
    request: Request & { id?: string; user?: AuthedUser },
    response: Response,
    start: number,
  ): void {
    const durationMs = Date.now() - start
    this.logger.log({
      method: request.method,
      path: request.originalUrl,
      status: response.statusCode,
      durationMs,
      requestId: request.id,
      userId: request.user?.id,
    })
  }
}
