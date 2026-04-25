import { Injectable } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'

import type { Env } from './env.schema'

@Injectable()
export class ConfigService {
  constructor(private readonly nest: NestConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.nest.get(key, { infer: true })
  }
}
