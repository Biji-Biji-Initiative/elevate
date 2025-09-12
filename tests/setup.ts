/**
 * Vitest setup file
 * Runs before each test file
 */

import { vi } from 'vitest'

// Mock external services
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: {
    users: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
}))

// Make @elevate/types/errors resolvable without building packages
vi.mock('@elevate/types/errors', async () => {
  // Resolve to source file via relative path during tests
  return await import('../packages/types/src/errors')
})

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => new Map()),
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}))

// Mock file system operations for uploads
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  stat: vi.fn(),
}))

// Mock rate limiter globally for tests to avoid header/IP requirements
vi.mock('@elevate/security', async () => ({
  withRateLimit: async (_req: unknown, _limiter: unknown, handler: () => unknown) => handler(),
  publicApiRateLimiter: {},
  adminRateLimiter: {},
  fileUploadRateLimiter: {},
  webhookRateLimiter: {},
  apiRateLimiter: {},
  submissionRateLimiter: {},
}))

// Provide a minimal safe server logger to avoid requiring built outputs
vi.mock('@elevate/logging/safe-server', () => ({
  getSafeServerLogger: async () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    forRequestWithHeaders: function (this: any, _req: unknown) {
      return this
    },
  }),
}))

// Mock crypto for consistent hashing in tests
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto')
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from('test-random-bytes')),
  }
})

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.KAJABI_WEBHOOK_SECRET = 'test-webhook-secret-123'
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-clerk-key'
process.env.CLERK_SECRET_KEY = 'test-clerk-secret'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

// Global test timeout
const originalTimeout = setTimeout
global.setTimeout = ((fn: (...args: unknown[]) => unknown, delay: number) => {
  if (delay > 30000) {
    console.warn(`Long timeout detected: ${delay}ms, reducing to 30s`)
    delay = 30000
  }
  return originalTimeout(fn, delay)
}) as typeof setTimeout
