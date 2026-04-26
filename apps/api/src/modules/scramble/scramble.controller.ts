import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { ScrambleResult } from '@rubik/shared'

import { Public } from '../../common/decorators/public.decorator'
import { ScrambleQueryDto } from './dto/scramble-query.dto'
import { ScrambleService } from './scramble.service'

@ApiTags('scramble')
@Controller({ path: 'scramble', version: '1' })
export class ScrambleController {
  constructor(private readonly service: ScrambleService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'Random WCA-style scramble for the puzzle' })
  scramble(@Query() query: ScrambleQueryDto): ScrambleResult {
    return this.service.randomScramble(query)
  }

  @Public()
  @Get('case/:caseSlug')
  @ApiOkResponse({ description: 'Deterministic scramble that lands on the named case' })
  @ApiNotFoundResponse({ description: 'case_not_found' })
  scrambleForCase(@Param('caseSlug') caseSlug: string): Promise<ScrambleResult> {
    return this.service.scrambleForCase(caseSlug)
  }
}
