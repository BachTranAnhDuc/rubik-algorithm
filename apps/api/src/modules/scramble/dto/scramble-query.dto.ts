import { ScrambleQuerySchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class ScrambleQueryDto extends createZodDto(ScrambleQuerySchema) {}
