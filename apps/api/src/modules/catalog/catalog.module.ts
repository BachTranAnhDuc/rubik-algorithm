import { Module } from '@nestjs/common'

import { CasesModule } from './cases/cases.module'
import { MethodsModule } from './methods/methods.module'
import { PuzzlesModule } from './puzzles/puzzles.module'
import { SetsModule } from './sets/sets.module'

@Module({
  imports: [PuzzlesModule, MethodsModule, SetsModule, CasesModule],
})
export class CatalogModule {}
