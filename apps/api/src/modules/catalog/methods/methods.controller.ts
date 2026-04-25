import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AlgorithmSet } from '@rubik/shared'

import { Public } from '../../../common/decorators/public.decorator'
import { MethodsService } from './methods.service'

@ApiTags('catalog')
@Controller({ path: 'puzzles', version: '1' })
export class MethodsController {
  constructor(private readonly service: MethodsService) {}

  @Public()
  @Get(':puzzleSlug/methods/:methodSlug/sets')
  @ApiOkResponse({ description: 'Algorithm sets for the given method' })
  @ApiNotFoundResponse({ description: 'puzzle_not_found or method_not_found' })
  listSets(
    @Param('puzzleSlug') puzzleSlug: string,
    @Param('methodSlug') methodSlug: string,
  ): Promise<AlgorithmSet[]> {
    return this.service.listSetsForMethod(puzzleSlug, methodSlug)
  }
}
