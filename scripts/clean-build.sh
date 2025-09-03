#!/bin/bash

# Clean Build Script - Ensures clean builds without stale artifacts
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🧹 Starting clean build process..."

# Run build policy check with clean and build
node scripts/build-policy-check.js --clean --build

echo "✅ Clean build completed successfully"