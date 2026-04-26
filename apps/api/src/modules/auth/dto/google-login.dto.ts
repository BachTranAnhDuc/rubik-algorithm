import { GoogleLoginSchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class GoogleLoginDto extends createZodDto(GoogleLoginSchema) {}
