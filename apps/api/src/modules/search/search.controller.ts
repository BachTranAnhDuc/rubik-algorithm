import { Controller, Get, Query } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { SearchResult } from '@rubik/shared'

import { Public } from '../../common/decorators/public.decorator'
import { SearchQueryDto } from './dto/search-query.dto'
import { SearchService } from './search.service'

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'FTS-then-trigram search across cases' })
  search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    return this.service.search(query.q, query.limit)
  }
}
