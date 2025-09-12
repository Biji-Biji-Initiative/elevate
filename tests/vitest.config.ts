import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..')
const baseTsconfigPath = path.resolve(workspaceRoot, 'tsconfig.base.json')

const SKIP_DB_FLAG = String(process.env.SKIP_DB_TESTS || '').toLowerCase()
const HAS_DB_URL = !!(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)
// Only skip DB if explicitly requested AND no DB URL is provided. This prevents accidental skips.
const SKIP_DB = (SKIP_DB_FLAG === '1' || SKIP_DB_FLAG === 'true') && !HAS_DB_URL

export default defineConfig({
  root: workspaceRoot,
  // Avoid tsconfig path plugin (which can mis-resolve cwd in CI); use explicit aliases instead.
  plugins: [],
  resolve: {
    alias: [
      // App-local alias for Admin app (Next.js "@/")
      { find: /^@\/(.*)$/, replacement: path.resolve(workspaceRoot, 'apps/admin/$1') },
      // Hard alias auth to source to guarantee subpaths work without a build
      { find: /^@elevate\/auth$/, replacement: path.resolve(workspaceRoot, 'packages/auth/src/index.ts') },
      { find: /^@elevate\/auth\/(.*)$/, replacement: path.resolve(workspaceRoot, 'packages/auth/src/$1') },
      // HTTP helpers (error envelopes, middleware)
      { find: /^@elevate\/http$/, replacement: path.resolve(workspaceRoot, 'packages/http/src/index.ts') },
      { find: /^@elevate\/http\/(.*)$/, replacement: path.resolve(workspaceRoot, 'packages/http/src/$1') },
      // Common dependencies needed by tests and auth helpers
      { find: /^@elevate\/types$/, replacement: path.resolve(workspaceRoot, 'packages/types/src/index.ts') },
      { find: /^@elevate\/types\/(.*)$/, replacement: path.resolve(workspaceRoot, 'packages/types/src/$1') },
      { find: /^@elevate\/logging$/, replacement: path.resolve(workspaceRoot, 'packages/logging/src/index.ts') },
      { find: /^@elevate\/logging\/(.*)$/, replacement: path.resolve(workspaceRoot, 'packages/logging/src/$1') },
      { find: /^@elevate\/security$/, replacement: path.resolve(workspaceRoot, 'packages/security/src/index.ts') },
      { find: /^@elevate\/security\/(.*)$/, replacement: path.resolve(workspaceRoot, 'packages/security/src/$1') },
      // UI package (resolve to source for tests)
      { find: /^@elevate\/ui$/, replacement: path.resolve(workspaceRoot, 'packages/ui/src/index.ts') },
      { find: /^@elevate\/ui\/(.*)$/, replacement: path.resolve(workspaceRoot, 'packages/ui/src/$1') },
    ],
  },
  test: {
    // To avoid DB races and unique constraint clashes during integration tests
    // we run tests in a single worker. Offline tests can be parallelized later.
    workers: 1,
    environment: 'node',
    globals: true,
    include: SKIP_DB
      ? [
          // Unit/offline tests only
          'tests/unit/**/*.{test,spec}.ts',
          'apps/**/tests/**/*.{test,spec}.ts',
          'apps/**/__tests__/**/*.{test,spec}.ts',
          'packages/**/__tests__/**/*.{test,spec}.ts',
          // Explicitly included known offline-safe tests
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
          'apps/**/tests/**/*.{test,spec}.ts',
          'apps/**/__tests__/**/*.{test,spec}.ts',
          'packages/**/__tests__/**/*.{test,spec}.ts',
        ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      // When skipping DB, also exclude integration/performance folders explicitly
      ...(SKIP_DB ? ['tests/integration/**', 'tests/performance/**', 'tests/e2e/**', 'packages/db/**'] : []),
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
    // Reduce flakiness from DB-level unique constraints when tests share fixed identifiers
    sequence: { concurrent: false, shuffle: false },
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
