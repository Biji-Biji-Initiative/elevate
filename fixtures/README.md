# Consumer Fixtures

This directory contains test fixtures that verify `@elevate/*` packages work correctly for external consumers. These fixtures are essential for ensuring package exports, TypeScript types, and runtime behavior work as expected.

## Overview

Consumer fixtures test packages from the perspective of an external application importing them, similar to how a real consumer would use the packages after they're published to npm.

## Fixtures

### `consumer-next15/`
Tests Next.js 15 + React 19 compatibility:
- Client/server component boundaries
- RSC (React Server Components) support
- Edge Runtime compatibility
- TypeScript integration
- UI component rendering

### `consumer-node/`
Tests pure Node.js ESM compatibility:
- Server-only package imports
- Business logic execution
- Type safety without framework
- ESM module resolution

## How they work

1. **Workspace Dependencies**: Fixtures use `workspace:*` to import local packages
2. **Real Consumer Testing**: Tests mimic how external apps would import packages
3. **Build Verification**: Ensures packages build correctly for consumers
4. **Type Safety**: Verifies TypeScript types resolve properly
5. **Runtime Testing**: Tests actual functionality, not just imports

## Running fixtures

From the monorepo root:

```bash
# Run all consumer verification tests
pnpm verify:consumer

# This runs:
# - Node.js fixture test (pnpm -C fixtures/consumer-node run test)
# - Next.js TypeScript checking (pnpm -C fixtures/consumer-next15 run type-check)  
# - Next.js build test (pnpm -C fixtures/consumer-next15 run build)
```

Individual fixtures:

```bash
# Test Node.js consumer
cd fixtures/consumer-node
pnpm test

# Test Next.js consumer
cd fixtures/consumer-next15
pnpm type-check
pnpm build
pnpm dev  # Optional: run dev server
```

## CI Integration

The `verify:consumer` script is part of the CI pipeline:

```bash
pnpm ci  # includes verify:consumer as a build gate
```

This ensures no packages can be published that break consumer applications.

## What gets tested

### Package Structure
- ✅ Correct exports in package.json
- ✅ TypeScript declaration files (.d.ts)
- ✅ ESM compatibility
- ✅ No missing peer dependencies

### Runtime Behavior  
- ✅ Functions execute correctly
- ✅ Types are properly inferred
- ✅ No circular dependencies
- ✅ Framework compatibility (Next.js)
- ✅ Edge Runtime support (server packages)

### Development Experience
- ✅ IntelliSense works correctly
- ✅ Type checking passes
- ✅ Build process succeeds
- ✅ No import errors

## Adding new fixtures

When adding support for new frameworks or environments:

1. Create new fixture directory: `fixtures/consumer-{name}/`
2. Add package.json with workspace dependencies
3. Create test files importing @elevate packages
4. Add to `verify:consumer` script in root package.json
5. Document in fixture README.md

## Troubleshooting

Common issues and solutions:

### Import errors
- Check package.json exports configuration
- Verify TypeScript paths mapping
- Ensure packages are built (`pnpm build`)

### Type errors
- Run `pnpm type-check` in individual packages
- Check tsconfig.json extends configuration
- Verify declaration files are generated

### Build failures
- Check peer dependency versions
- Ensure all required packages are installed
- Verify next.config.js transpilePackages setting