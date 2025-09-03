#!/bin/bash

# Build packages first
echo "Building packages..."
pnpm -F @elevate/types build
pnpm -F @elevate/db build
pnpm -F @elevate/auth build
pnpm -F @elevate/storage build
pnpm -F @elevate/ui build

# Build apps without linting
echo "Building web app..."
cd apps/web && SKIP_ENV_VALIDATION=1 npx next build --no-lint
cd ../..

echo "Building admin app..."
cd apps/admin && SKIP_ENV_VALIDATION=1 npx next build --no-lint
cd ../..

echo "Build complete!"