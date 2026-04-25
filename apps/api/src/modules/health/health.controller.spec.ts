import { Test } from '@nestjs/testing'
import { HealthCheckService } from '@nestjs/terminus'
import type { Cache } from 'cache-manager'
import { PrismaService } from 'nestjs-prisma'
import { describe, expect, it, vi } from 'vitest'

import { CACHE_MANAGER } from '@nestjs/cache-manager'

import { HealthController } from './health.controller'

const buildController = async (overrides: {
  prisma?: Partial<PrismaService>
  cache?: Partial<Cache>
} = {}) => {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      {
        provide: HealthCheckService,
        useValue: {
          check: async (
            checks: Array<() => Promise<Record<string, unknown>>>,
          ) => {
            const results = await Promise.all(checks.map((c) => c()))
            return { status: 'ok', info: Object.assign({}, ...results) }
          },
        },
      },
      {
        provide: PrismaService,
        useValue: {
          $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
          ...overrides.prisma,
        },
      },
      {
        provide: CACHE_MANAGER,
        useValue: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue('ok'),
          ...overrides.cache,
        },
      },
    ],
  }).compile()

  return moduleRef.get(HealthController)
}

describe('HealthController', () => {
  it('returns ok for liveness', async () => {
    const controller = await buildController()
    expect(controller.liveness()).toEqual({ status: 'ok' })
  })

  it('reports both subsystems up when healthy', async () => {
    const controller = await buildController()
    const result = await controller.readiness()

    expect(result).toMatchObject({
      info: {
        prisma: { status: 'up' },
        redis: { status: 'up' },
      },
    })
  })

  it('reports prisma down on query failure', async () => {
    const controller = await buildController({
      prisma: { $queryRaw: vi.fn().mockRejectedValue(new Error('boom')) },
    })
    const result = await controller.readiness()

    expect(result.info?.prisma).toMatchObject({
      status: 'down',
      message: 'boom',
    })
  })

  it('reports redis down when cache value mismatches', async () => {
    const controller = await buildController({
      cache: {
        set: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(undefined),
      },
    })
    const result = await controller.readiness()

    expect(result.info?.redis).toMatchObject({ status: 'down' })
  })
})
