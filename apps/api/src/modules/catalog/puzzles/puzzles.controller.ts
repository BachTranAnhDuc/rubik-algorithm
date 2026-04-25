import { Controller, Get, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { Method, Puzzle } from '@rubik/shared'

import { PublicCacheable } from '../../../common/decorators/public-cacheable.decorator'
import { PuzzlesService } from './puzzles.service'

@ApiTags('catalog')
@Controller({ path: 'puzzles', version: '1' })
export class PuzzlesController {
  constructor(private readonly service: PuzzlesService) {}

  @PublicCacheable()
  @Get()
  @ApiOkResponse({ description: 'List of puzzles ordered by displayOrder' })
  list(): Promise<Puzzle[]> {
    return this.service.listPuzzles()
  }

  @PublicCacheable()
  @Get(':puzzleSlug/methods')
  @ApiOkResponse({ description: 'Methods for the given puzzle' })
  @ApiNotFoundResponse({ description: 'puzzle_not_found' })
  listMethods(@Param('puzzleSlug') puzzleSlug: string): Promise<Method[]> {
    return this.service.listMethodsForPuzzle(puzzleSlug)
  }
}
