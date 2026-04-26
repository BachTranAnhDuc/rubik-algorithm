import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common'
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { TokenPair } from '@rubik/shared'
import type { Request } from 'express'

import { Public } from '../../common/decorators/public.decorator'
import { AuthService } from './auth.service'
import { GoogleLoginDto } from './dto/google-login.dto'
import { RefreshRequestDto } from './dto/refresh-request.dto'

const extractContext = (req: Request) => ({
  userAgent: req.get('user-agent') ?? null,
  ip: req.ip ?? null,
})

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('google')
  @ApiOkResponse({ description: 'TokenPair on a verified Google ID token' })
  google(@Body() body: GoogleLoginDto, @Req() req: Request): Promise<TokenPair> {
    return this.auth.loginWithGoogle(body, extractContext(req))
  }

  @Public()
  @Post('refresh')
  @ApiOkResponse({ description: 'New TokenPair; old refresh is revoked' })
  refresh(@Body() body: RefreshRequestDto, @Req() req: Request): Promise<TokenPair> {
    return this.auth.rotate(body.refreshToken, extractContext(req))
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Refresh token revoked (idempotent)' })
  async logout(@Body() body: RefreshRequestDto): Promise<void> {
    await this.auth.logout(body.refreshToken)
  }
}
