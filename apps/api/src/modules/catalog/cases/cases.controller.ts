import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AlgorithmCaseWithVariants } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { CasesService } from './cases.service'

@ApiTags('catalog')
@Controller({ path: 'cases', version: '1' })
export class CasesController {
  constructor(private readonly service: CasesService) {}

  @Public()
  @Get(':caseSlug')
  @ApiOkResponse({ description: 'Case detail with variants' })
  @ApiNotFoundResponse({ description: 'case_not_found' })
  get(@Param('caseSlug') caseSlug: string): Promise<AlgorithmCaseWithVariants> {
    return this.service.getCaseBySlug(caseSlug)
  }
}
