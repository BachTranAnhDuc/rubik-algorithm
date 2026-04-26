export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, limit: number) => ['search', q, limit] as const,
}
