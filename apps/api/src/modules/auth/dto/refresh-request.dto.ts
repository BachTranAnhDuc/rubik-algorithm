import { RefreshRequestSchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class RefreshRequestDto extends createZodDto(RefreshRequestSchema) {}
