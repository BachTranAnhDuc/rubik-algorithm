import { applyDecorators, Header } from '@nestjs/common'

import { Public } from './public.decorator'

const TEN_MINUTES = 600
const ONE_DAY = 86400

type PublicCacheableOptions = {
  sMaxAge?: number
  staleWhileRevalidate?: number
}

// @Header is method-only; do not apply this decorator at the controller class level.
export const PublicCacheable = (options?: PublicCacheableOptions): MethodDecorator => {
  const sMaxAge = options?.sMaxAge ?? TEN_MINUTES
  const swr = options?.staleWhileRevalidate ?? ONE_DAY
  return applyDecorators(
    Public(),
    Header('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`),
  )
}
