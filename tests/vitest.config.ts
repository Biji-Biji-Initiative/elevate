import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const SKIP_DB = String(process.env.SKIP_DB_TESTS || '').toLowerCase() === '1' ||
  String(process.env.SKIP_DB_TESTS || '').toLowerCase() === 'true'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: SKIP_DB
      ? [
          // Unit tests (no-DB)
          'tests/unit/**/*.{test,spec}.ts',
          // Selected web route/unit tests that fully mock DB/external deps
          // Only offline-safe web tests
          'apps/web/tests/metrics-helpers.test.ts',
          'apps/web/tests/metrics-*.test.ts',
          'apps/web/tests/stats-dto.test.ts',
          'apps/web/tests/stats-optimized-contract.test.ts',
          'apps/web/tests/profile-*.test.ts',
          'apps/web/tests/files-*.test.ts',
          'apps/web/tests/slo-endpoint.test.ts',
        ]
      : [
          'tests/**/*.{test,spec}.ts',
          'tests/**/*.integration.{test,spec}.ts',
          'tests/**/*.e2e.{test,spec}.ts',
        ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      // When skipping DB, also exclude integration/performance folders explicitly
      ...(SKIP_DB ? ['tests/integration/**', 'tests/performance/**', 'tests/e2e/**'] : []),
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
    pool: SKIP_DB ? 'threads' : 'forks',
    poolOptions: SKIP_DB
      ? {
          threads: {
            isolate: true,
            singleThread: true,
          },
        }
      : {
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
