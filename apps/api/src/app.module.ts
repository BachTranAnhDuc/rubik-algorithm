import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'

import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { CacheModule } from './infra/cache/cache.module'
import { ConfigModule } from './infra/config/config.module'
import { LoggerModule } from './infra/logger/logger.module'
import { PrismaModule } from './infra/prisma/prisma.module'
import { TelemetryModule } from './infra/telemetry/telemetry.module'
import { ThrottlerModule } from './infra/throttler/throttler.module'
import { AuthModule } from './modules/auth/auth.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { HealthModule } from './modules/health/health.module'
import { MeModule } from './modules/me/me.module'

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    CacheModule,
    ThrottlerModule,
    TelemetryModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    MeModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
