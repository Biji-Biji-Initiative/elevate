# Troubleshooting Guide

Quick solutions for common build and development issues in the MS Elevate LEAPS Tracker monorepo.

## 🚨 Common Build Issues

### "Output file has already been written" (TS6305)

**Symptoms**: TypeScript build fails with TS6305 errors
**Root Cause**: Duplicate project references in root `tsconfig.json` 
**Solution**: 
```bash
pnpm run validate:tsconfig  # Check for duplicates
# Fix any duplicates found in root tsconfig.json
```

### "Module not found: Can't resolve '@elevate/...' "

**Symptoms**: Next.js can't import workspace packages
**Root Cause**: Missing build artifacts for workspace packages
**Solution**:
```bash
pnpm run verify:build-health  # Check what's missing
pnpm run build:types         # Build TypeScript declarations
pnpm -r --filter "@elevate/*" run build:js  # Build JavaScript
```

### "Failed to read source code from packages/.../dist/js/..."

**Symptoms**: Turbopack/Next.js can't find built package files  
**Root Cause**: Package built but missing specific entry points
**Solution**:
```bash
# Rebuild the specific failing package
cd packages/[package-name]
pnpm run build

# Or rebuild all packages
pnpm -r --filter "@elevate/*" run build
```

### Build hangs or takes very long

**Symptoms**: `pnpm run build` never completes
**Root Cause**: Circular dependencies or infinite TypeScript resolution
**Solution**:
```bash
# Clear caches and try again
pnpm store prune
rm -rf node_modules .next turbo
pnpm install
pnpm run validate:tsconfig
```

## 🔧 Development Setup Issues

### Node.js version issues

**Error**: "Node.js version X is not supported"
**Solution**: Upgrade to Node.js 20.11 or higher
```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### pnpm not found

**Error**: "pnpm: command not found"
**Solution**: Install pnpm globally
```bash
npm install -g pnpm
# Or via Corepack (Node 16+)
corepack enable pnpm
```

### Database connection errors

**Symptoms**: "relation does not exist" errors for materialized views
**Root Cause**: Missing database views (non-critical for development)  
**Solution**:
```bash
# Check database connection
pnpm run env:check

# If connection works, the missing views are expected in development
# The app core functionality will still work
```

## 📦 Package-Specific Issues

### @elevate/ui build issues

**Common Issue**: Missing CSS files or client components
**Solution**:
```bash
cd packages/ui
pnpm run clean
pnpm run build
# Check that dist/js/index.js and dist/styles/globals.css exist
```

### @elevate/logging missing slo-monitor

**Error**: "Can't resolve '@elevate/logging/slo-monitor'"
**Solution**:
```bash
cd packages/logging
pnpm run build
# Verify dist/js/slo-monitor.js exists
```

## 🎯 Quick Recovery Commands

### Start from scratch (nuclear option)
```bash
# Clean everything
pnpm clean
rm -rf node_modules .next turbo

# Fresh setup
pnpm install
pnpm run setup:new-dev
```

### Quick health check
```bash
# Run all validation checks
pnpm run validate:tsconfig
pnpm run verify:build-health  
pnpm run verify:exports
```

### Fix build after changes
```bash
# Standard build recovery
pnpm run typecheck:build
pnpm run build:types
pnpm -r --filter "@elevate/*" run build:js
```

## 💡 Prevention Tips

1. **Run validation before big changes**: `pnpm run validate:tsconfig`
2. **Check build health after package updates**: `pnpm run verify:build-health`
3. **Use the new developer setup**: `pnpm run setup:new-dev`
4. **Follow BUILDING.md for complex changes**: Two-stage build process is required

## 📞 Getting Help

If you're still stuck after trying these solutions:

1. Check the error logs: Look for specific file paths and error codes
2. Verify your environment: Node.js version, pnpm version, current directory
3. Try the nuclear option: Clean install and rebuild everything
4. Check BUILDING.md: For detailed monorepo architecture and build process

## Common Error Messages

| Error | Likely Cause | Quick Fix |
|-------|-------------|-----------|
| TS6305 | Duplicate tsconfig references | `pnpm run validate:tsconfig` |
| Module not found @elevate/* | Missing package build | `pnpm -F @elevate/[package] build` |
| Can't resolve dist/js/... | Incomplete build | `pnpm run verify:build-health` |
| relation "..." does not exist | Missing DB views (expected) | Non-critical, app still works |

**Last updated**: Based on issues resolved during Replit environment setup