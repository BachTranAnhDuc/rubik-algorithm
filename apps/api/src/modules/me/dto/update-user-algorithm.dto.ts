import { UpdateUserAlgorithmSchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateUserAlgorithmDto extends createZodDto(UpdateUserAlgorithmSchema) {}
