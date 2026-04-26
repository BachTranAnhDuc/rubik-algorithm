import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common'
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { UserAlgorithm } from '@prisma/client'
import type { User } from '@rubik/shared'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthedUser } from '../../common/types/authed-request'
import { UpdateUserAlgorithmDto } from './dto/update-user-algorithm.dto'
import { MeService } from './me.service'

@ApiTags('me')
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get()
  @ApiOkResponse({ description: 'The authenticated user (public fields)' })
  getCurrent(@CurrentUser() user: AuthedUser): Promise<User> {
    return this.service.getCurrent(user.id)
  }

  @Get('algorithms')
  @ApiOkResponse({ description: 'Personal algorithm sheet ordered by updatedAt desc' })
  listAlgorithms(@CurrentUser() user: AuthedUser): Promise<UserAlgorithm[]> {
    return this.service.listAlgorithms(user.id)
  }

  @Put('algorithms/:caseSlug')
  @ApiOkResponse({ description: 'Upsert the user-algorithm row for the case' })
  upsertAlgorithm(
    @CurrentUser() user: AuthedUser,
    @Param('caseSlug') caseSlug: string,
    @Body() body: UpdateUserAlgorithmDto,
  ): Promise<UserAlgorithm> {
    return this.service.upsertAlgorithm(user.id, caseSlug, body)
  }

  @Delete('algorithms/:caseSlug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Idempotent delete of the user-algorithm row' })
  deleteAlgorithm(
    @CurrentUser() user: AuthedUser,
    @Param('caseSlug') caseSlug: string,
  ): Promise<void> {
    return this.service.deleteAlgorithm(user.id, caseSlug)
  }
}
