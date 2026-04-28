export const scrambleKeys = {
  all: ['scramble'] as const,
  random: () => ['scramble', 'random'] as const,
  forCase: (slug: string) => ['scramble', 'case', slug] as const,
}
