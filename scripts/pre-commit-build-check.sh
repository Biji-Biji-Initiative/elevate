#!/bin/bash

# Pre-commit hook to enforce build artifact policy
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "🔍 Running pre-commit build artifact policy check..."

# Check if any dist files are being committed
if git diff --cached --name-only | grep -qE "packages/.*/dist/"; then
    echo "❌ ERROR: Attempting to commit build artifacts (dist files)"
    echo "Build artifacts should not be committed. They are generated from source."
    echo ""
    echo "To fix this:"
    echo "  1. Remove dist files from staging: git reset packages/*/dist/"
    echo "  2. Ensure .gitignore includes dist/ patterns"
    echo "  3. Run: pnpm run build:clean"
    echo ""
    exit 1
fi

# Check if any .tsbuildinfo files are being committed  
if git diff --cached --name-only | grep -qE "\.tsbuildinfo$"; then
    echo "❌ ERROR: Attempting to commit TypeScript build info files"
    echo "These files are build artifacts and should not be committed."
    echo ""
    echo "To fix this:"
    echo "  1. Remove from staging: git reset **/*.tsbuildinfo"
    echo "  2. Ensure .gitignore includes *.tsbuildinfo pattern"
    echo ""
    exit 1
fi

# Run build policy check
if ! pnpm run build:check; then
    echo "❌ ERROR: Build policy check failed"
    echo ""
    echo "To fix this:"
    echo "  1. Run: pnpm run build:clean"
    echo "  2. Fix any TypeScript compilation errors"
    echo "  3. Ensure all packages build successfully"
    echo ""
    exit 1
fi

echo "✅ Build artifact policy check passed"