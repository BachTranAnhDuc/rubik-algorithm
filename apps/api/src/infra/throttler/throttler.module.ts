import { Global, Module } from '@nestjs/common'
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler'

import { ConfigService } from '../config/config.service'

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

@Global()
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        throttlers: [
          { name: 'public', ttl: MINUTE_MS, limit: 60 },
          { name: 'authed', ttl: MINUTE_MS, limit: 120 },
          { name: 'auth', ttl: MINUTE_MS, limit: 10 },
        ],
      }),
    }),
  ],
})
export class ThrottlerModule {}
