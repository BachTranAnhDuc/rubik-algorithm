import { Module } from '@nestjs/common'

import { ScrambleController } from './scramble.controller'
import { ScrambleService } from './scramble.service'

@Module({
  controllers: [ScrambleController],
  providers: [ScrambleService],
})
export class ScrambleModule {}
