import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/**/*.{test,spec}.ts',
      'tests/**/*.integration.{test,spec}.ts',
      'tests/**/*.e2e.{test,spec}.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**'
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: [
        'apps/**/*.ts',
        'packages/**/*.ts'
      ],
      exclude: [
        'apps/**/*.test.ts',
        'apps/**/*.spec.ts',
        'packages/**/*.test.ts',
        'packages/**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    globalSetup: './tests/global-setup.ts',
    env: {
      NODE_ENV: 'test',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      KAJABI_WEBHOOK_SECRET: 'test-webhook-secret-123',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'test-clerk-key',
      CLERK_SECRET_KEY: 'test-clerk-secret',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000'
    }
  }
})