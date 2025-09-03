# Node.js Consumer Fixture

This fixture tests that server-safe `@elevate/*` packages work correctly in a pure Node.js ESM environment without any framework dependencies.

## Purpose

- Verifies server-only packages work in Node.js 20+ runtime
- Tests ESM imports and module resolution
- Ensures no React/Next.js dependencies leak into server packages
- Validates that business logic can run in batch/CLI environments
- Tests package exports and TypeScript types for Node.js consumers

## What it tests

### Core Packages
- `@elevate/types` - All enums, interfaces, and type definitions
- `@elevate/security` - Server-safe validation and sanitization functions
- `@elevate/logic` - Business logic and calculation functions
- `@elevate/storage` - Storage client creation and utilities
- `@elevate/config` - Configuration management
- `@elevate/db` - Database client (when available)

### Not included
- `@elevate/ui` - Client-only React components
- `@elevate/auth` - Next.js-specific auth middleware
- Framework-specific integrations

## Running the test

From the fixture directory:
```bash
# Run Node.js import test
pnpm test

# Type checking
pnpm type-check
```

From the root of the monorepo:
```bash
# Run all consumer verifications
pnpm verify:consumer
```

## Expected behavior

- ✅ All server-safe packages import without errors
- ✅ TypeScript types resolve correctly
- ✅ Functions execute properly in Node.js environment
- ✅ No framework dependencies or client-only code
- ✅ ESM module resolution works
- ✅ Package exports are properly configured

## Exit codes

- `0` - All tests passed successfully
- `1` - One or more package imports or tests failed