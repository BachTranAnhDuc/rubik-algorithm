import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'

import { ConfigService } from '../../../../infra/config/config.service'
import { JwtStrategy } from '../jwt.strategy'

const ACCESS_SECRET = 'a'.repeat(32)

describe('JwtStrategy', () => {
  it('returns { id, email } from JWT claims with no DB lookup', async () => {
    const config = {
      get: vi.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined)),
    }
    const moduleRef = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: ConfigService, useValue: config }],
    }).compile()
    const strategy = moduleRef.get(JwtStrategy)

    const result = strategy.validate({ sub: 'u1', email: 'a@b.com' })

    expect(result).toEqual({ id: 'u1', email: 'a@b.com' })
  })
})
