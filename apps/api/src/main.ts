import 'reflect-metadata'
import './infra/telemetry/tracing'
import './infra/telemetry/sentry'

import { VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import compression from 'compression'
import helmet from 'helmet'
import { Logger as PinoLogger } from 'nestjs-pino'

import { AppModule } from './app.module'
import { ConfigService } from './infra/config/config.service'

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  // TODO(ducbach, 2026-04-26): set 'trust proxy' for accurate req.ip behind Cloudflare/Fly.
  // Currently RefreshToken.ip captures the proxy IP in prod, not the client. Sub-phase 9 work.
  app.useLogger(app.get(PinoLogger))

  app.use(helmet())
  app.use(compression())
  app.enableShutdownHooks()
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  const config = app.get(ConfigService)
  const corsOrigins = config.get('CORS_ORIGINS')
  if (corsOrigins) {
    app.enableCors({
      origin: corsOrigins.split(',').map((s) => s.trim()),
      credentials: false,
    })
  }

  await app.listen(config.get('PORT'))
}

void bootstrap()
