# Next.js 15 Consumer Fixture

This fixture tests that all `@elevate/*` packages work correctly when consumed by a Next.js 15 application with React 19.

## Purpose

- Verifies client/server component boundaries work correctly
- Tests that TypeScript types resolve properly for external consumers
- Ensures no missing peer dependencies or version conflicts
- Validates RSC (React Server Components) compatibility
- Tests Edge Runtime compatibility for server-safe packages

## What it tests

### Client Components (`app/page.tsx`)
- `@elevate/ui` components with proper rendering
- `@elevate/types` enums and types
- Client-side functionality and interactivity

### Server Components (`app/api/*/route.ts`)
- `@elevate/auth` middleware and utilities
- `@elevate/db` database client
- `@elevate/security` server-safe functions
- `@elevate/logic` business logic functions
- All server-only packages

### Edge Runtime (`app/api/edge-test/route.ts`)
- Tests packages work in Vercel Edge Runtime
- Validates no Node.js built-ins are leaked
- Ensures lightweight server-safe functions work

## Running the tests

From the fixture directory:
```bash
# Type checking
pnpm type-check

# Build test (includes RSC compilation)
pnpm build

# Development server
pnpm dev
```

From the root of the monorepo:
```bash
# Run all consumer verifications
pnpm verify:consumer
```

## Expected behavior

- ✅ All TypeScript types should resolve correctly
- ✅ Next.js should build without errors
- ✅ No circular dependencies or import issues
- ✅ Client/server boundaries respected
- ✅ Edge Runtime tests pass
- ✅ All UI components render properly