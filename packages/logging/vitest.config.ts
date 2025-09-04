import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      exclude: ['dist/**', '**/*.d.ts', '**/*.config.ts']
    },
    testTimeout: 10000,
  },
})