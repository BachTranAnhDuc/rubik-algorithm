import { Global, Module } from '@nestjs/common'
import { PrismaModule as NestPrismaModule } from 'nestjs-prisma'

@Global()
@Module({
  imports: [
    NestPrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: {
        prismaOptions: {
          log: ['warn', 'error'],
        },
        explicitConnect: false,
      },
    }),
  ],
})
export class PrismaModule {}
