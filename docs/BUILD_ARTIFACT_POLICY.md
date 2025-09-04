# Build Artifact Policy

## Overview

This document outlines the build artifact policy for the MS Elevate LEAPS Tracker monorepo to prevent stale JavaScript artifacts from masking broken TypeScript compilation errors.

## Problem Statement

Previously, the project was susceptible to a dangerous scenario where:
1. TypeScript source code contains compilation errors
2. Stale JavaScript artifacts in `dist/` directories continue to exist from previous successful builds
3. Applications continue to work using the stale artifacts, masking the TypeScript errors
4. Developers remain unaware of critical type safety issues

## Solution: Build-from-Source Policy

We've implemented a comprehensive **build-from-source policy** with the following key principles:

### 1. Clean Builds Always
- All builds start with cleaned `dist/` directories
- No reliance on potentially stale artifacts
- Fresh compilation from TypeScript source every time

### 2. TypeScript-First Validation
- TypeScript compilation must succeed before any JavaScript artifacts are generated
- Failed TypeScript compilation immediately stops the build process
- No stale JS artifacts can mask TS compilation errors

### 3. Automated Policy Enforcement
- Build policy checks run automatically in CI/CD
- Manual override protection through scripted enforcement
- Hash verification ensures source-build consistency

### 4. Git Repository Hygiene
- All `dist/` directories are properly `.gitignore`d
- No build artifacts committed to source control
- Clean separation between source code and compiled outputs

## Policy Implementation

### New Build Scripts

```bash
# Clean build (recommended for development)
pnpm run build:clean

# Verify build policy compliance
pnpm run build:check

# Verify existing build hashes
pnpm run build:verify
```

### Build Policy Enforcement Tool

Location: `scripts/build-policy-check.js`

**Features:**
- Cleans all package `dist/` directories
- Verifies TypeScript compilation before JS generation  
- Checks that all `tsup.config.ts` files have `clean: true`
- Validates `.gitignore` patterns for build artifacts
- Generates and verifies source code hashes
- Comprehensive error reporting

**Usage:**
```bash
# Full clean and rebuild
node scripts/build-policy-check.js --clean --build

# Verify existing builds
node scripts/build-policy-check.js --verify

# Policy check only
node scripts/build-policy-check.js
```

### CI/CD Integration

The CI pipeline now includes build policy checks:

```bash
pnpm run ci
```

This runs:
1. `build:check` - Validates policy compliance
2. `typecheck:build` - TypeScript compilation check
3. `build:clean` - Clean rebuild of all packages
4. Standard linting, testing, and verification steps

## Configuration Requirements

### tsup.config.ts Files

All package build configurations must include:

```typescript
export default defineConfig({
  // ... other options
  clean: true,  // REQUIRED: Ensures clean builds
  // ... other options
})
```

### TypeScript Build Configuration

Packages use a two-step build process:

1. **Type Generation**: `tsc -b --force tsconfig.build.json`
   - Generates `.d.ts` files in `dist/types/`
   - Must succeed before JS compilation
   
2. **JavaScript Bundling**: `tsup --config tsup.config.ts`
   - Generates JS files in `dist/js/`
   - Only runs if TypeScript compilation succeeds

### Package.json Scripts

Standard package build script pattern:

```json
{
  "scripts": {
    "build": "pnpm run build:types && tsup --config tsup.config.ts",
    "build:types": "tsc -b --force tsconfig.build.json",
    "clean": "rm -rf dist"
  }
}
```

## Team Workflow Guidelines

### Development Workflow

1. **Regular Development**:
   ```bash
   pnpm dev        # Normal development with hot reload
   ```

2. **Before Committing**:
   ```bash
   pnpm run build:clean    # Ensure clean build works
   ```

3. **Debugging Build Issues**:
   ```bash
   pnpm run build:check    # Identify policy violations
   pnpm run typecheck:build # Isolate TypeScript errors
   ```

### Common Scenarios

#### "My build was working yesterday but fails today"

This indicates TypeScript errors that were previously masked by stale artifacts:

1. Run `pnpm run typecheck:build` to see TypeScript errors
2. Fix the TypeScript compilation errors
3. Run `pnpm run build:clean` to verify the fix

#### "CI builds fail but local builds work"

This suggests stale artifacts in your local environment:

1. Run `pnpm run build:clean` locally
2. If it fails, fix the revealed TypeScript errors
3. Commit and push the fixes

#### "I need to add a new package field or export"

1. Update the package's TypeScript source
2. Update `package.json` exports if needed
3. Run `pnpm run build:clean` to verify
4. Update consuming code as needed

## Policy Verification

### Automatic Verification

The build policy is automatically verified by:

- **Pre-commit checks**: Ensure clean builds work
- **CI pipeline**: Full policy enforcement on every PR
- **Hash verification**: Detect source/build mismatches

### Manual Verification

You can manually verify policy compliance:

```bash
# Check all policy requirements
pnpm run build:check

# Verify no stale artifacts exist
pnpm run build:clean

# Check source-build consistency
pnpm run build:verify
```

## Troubleshooting

### Build Policy Check Failures

**Error: "TypeScript compilation failed"**
- Fix TypeScript errors in the failing packages
- Run `pnpm run typecheck:build` for detailed error information

**Error: "tsup config should have 'clean: true'"**
- Update the package's `tsup.config.ts` to include `clean: true`

**Error: "Found tracked dist files in git"**
- Remove the tracked files: `git rm -r packages/*/dist/`
- Commit the removal

### Common TypeScript Errors

**Missing dependencies:**
```bash
pnpm install  # Ensure all dependencies are installed
```

**Type import/export issues:**
- Check package exports in `package.json`
- Verify TypeScript references in `tsconfig.json`

**Stale type definitions:**
```bash
pnpm run build:clean  # Regenerate all type definitions
```

## Benefits

### Reliability
- ✅ No stale artifacts masking TypeScript errors
- ✅ Consistent builds across all environments
- ✅ Early detection of type safety issues

### Developer Experience  
- ✅ Clear error messages when builds fail
- ✅ Fast feedback on TypeScript issues
- ✅ Automated policy enforcement

### Repository Health
- ✅ Clean git history without build artifacts
- ✅ Smaller repository size
- ✅ No merge conflicts on generated files

## Migration Notes

### From Stale Artifacts to Clean Builds

If you have existing stale artifacts:

1. Run `pnpm run build:clean` 
2. Fix any revealed TypeScript errors
3. Verify all packages build successfully
4. Continue with normal development

### Updating Existing Packages

When adding new packages or modifying existing ones:

1. Ensure `tsup.config.ts` includes `clean: true`
2. Follow the standard build script pattern
3. Test with `pnpm run build:clean`
4. Verify exports work correctly in consuming code

## Future Enhancements

### Planned Improvements

- **Build caching optimization**: Smart caching based on source hashes
- **Parallel build safety**: Ensure race condition safety
- **Advanced verification**: Deep dependency validation
- **Performance monitoring**: Build time optimization

### Monitoring and Metrics

- Track build policy compliance rates
- Monitor TypeScript error resolution times  
- Measure build performance impact
- Alert on policy violations

---

## Summary

The build artifact policy ensures **reliable, repeatable builds** by enforcing clean compilation from TypeScript source code. This prevents the dangerous scenario where stale JavaScript artifacts mask critical TypeScript compilation errors, improving both code quality and developer confidence.

**Key takeaway**: Always use `pnpm run build:clean` when in doubt about build integrity.