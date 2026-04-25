import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AlgorithmSetWithCases } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { SetsService } from './sets.service'

@ApiTags('catalog')
@Controller({ path: 'sets', version: '1' })
export class SetsController {
  constructor(private readonly service: SetsService) {}

  @Public()
  @Get(':setSlug')
  @ApiOkResponse({ description: 'Set detail with cases + variants (denormalized)' })
  @ApiNotFoundResponse({ description: 'set_not_found' })
  get(@Param('setSlug') setSlug: string): Promise<AlgorithmSetWithCases> {
    return this.service.getSetBySlug(setSlug)
  }
}
