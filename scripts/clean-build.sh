#!/bin/bash

# Clean Build Script - Ensures clean builds without stale artifacts
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🧹 Starting clean build process..."

# Remove stray generated declaration files under src to enforce dist-only policy
echo "🗑️  Removing stray src/*.d.ts artifacts..."
find packages -type f \( -name "*.d.ts" -o -name "*.d.ts.map" \) -path "*/src/*" -print -delete || true

# First: clean all build artifacts via policy checker
node scripts/build-policy-check.js --clean

# Build declaration types for all packages so downstream typecheck sees dist/types
pnpm -r --filter @elevate/* run build:types

# Run a full typecheck to validate graph after fresh types
pnpm run typecheck:build

# Optionally verify build policy without re-cleaning
node scripts/build-policy-check.js --verify

echo "✅ Clean build completed successfully"