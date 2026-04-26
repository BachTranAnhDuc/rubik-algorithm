import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { GoogleVerifierService } from './google/google-verifier.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { TokenService } from './token.service'

@Global()
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, GoogleVerifierService, JwtStrategy],
  exports: [TokenService, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
