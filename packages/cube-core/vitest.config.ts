import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', '**/*.spec.ts', 'src/**/types.ts'],
    },
  },
})
