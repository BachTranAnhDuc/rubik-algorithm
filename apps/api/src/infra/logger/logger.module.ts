import { Global, Module } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'

import { ConfigService } from '../config/config.service'

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production'
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            genReqId: (req) =>
              (req.headers['x-request-id'] as string | undefined) ??
              randomUUID(),
            customProps: () => ({ service: 'api' }),
            ...(isProd
              ? {}
              : {
                  transport: {
                    target: 'pino-pretty',
                    options: { singleLine: true, colorize: true },
                  },
                }),
          },
        }
      },
    }),
  ],
})
export class LoggerModule {}
