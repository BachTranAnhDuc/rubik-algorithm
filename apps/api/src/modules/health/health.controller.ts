import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Controller, Get, Inject } from '@nestjs/common'
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
} from '@nestjs/terminus'
import type { Cache } from 'cache-manager'
import { PrismaService } from 'nestjs-prisma'

import { Public } from '../../common/decorators/public.decorator'

const READYZ_PROBE_KEY = 'readyz:probe'
const READYZ_PROBE_VALUE = 'ok'
const READYZ_PROBE_TTL_MS = 5_000

@Controller({ version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Public()
  @Get('healthz')
  liveness(): { status: 'ok' } {
    return { status: 'ok' }
  }

  @Public()
  @Get('readyz')
  @HealthCheck()
  async readiness() {
    return this.health.check([
      () => this.checkPrisma(),
      () => this.checkCache(),
    ])
  }

  private async checkPrisma(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { prisma: { status: 'up' } }
    } catch (error) {
      return {
        prisma: {
          status: 'down',
          message: error instanceof Error ? error.message : 'unknown',
        },
      }
    }
  }

  private async checkCache(): Promise<HealthIndicatorResult> {
    try {
      await this.cache.set(READYZ_PROBE_KEY, READYZ_PROBE_VALUE, READYZ_PROBE_TTL_MS)
      const value = await this.cache.get<string>(READYZ_PROBE_KEY)
      return {
        redis: {
          status: value === READYZ_PROBE_VALUE ? 'up' : 'down',
        },
      }
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: error instanceof Error ? error.message : 'unknown',
        },
      }
    }
  }
}
