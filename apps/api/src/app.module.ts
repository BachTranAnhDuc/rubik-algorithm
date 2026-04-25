import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { CacheModule } from './infra/cache/cache.module'
import { ConfigModule } from './infra/config/config.module'
import { LoggerModule } from './infra/logger/logger.module'
import { PrismaModule } from './infra/prisma/prisma.module'
import { TelemetryModule } from './infra/telemetry/telemetry.module'
import { ThrottlerModule } from './infra/throttler/throttler.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    TelemetryModule,
    HealthModule,
    CatalogModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
