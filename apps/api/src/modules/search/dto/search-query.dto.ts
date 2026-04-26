import { SearchQuerySchema } from '@rubik/shared'
import { createZodDto } from 'nestjs-zod'

export class SearchQueryDto extends createZodDto(SearchQuerySchema) {}
