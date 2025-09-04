#!/bin/bash

# Setup script for build artifact policy enforcement
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🚀 Setting up build artifact policy enforcement..."

# Ensure scripts are executable
chmod +x scripts/build-policy-check.js
chmod +x scripts/clean-build.sh  
chmod +x scripts/pre-commit-build-check.sh

# Install pre-commit hook (optional)
if [ -d ".git" ]; then
    echo "📎 Installing pre-commit hook..."
    
    # Create pre-commit hook that calls our script
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
exec ./scripts/pre-commit-build-check.sh
EOF
    
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook installed"
else
    echo "⚠️  Not a git repository - skipping pre-commit hook installation"
fi

# Run initial policy check
echo "🔍 Running initial build policy check..."
if pnpm run build:check; then
    echo "✅ Build policy check passed"
else
    echo "⚠️  Build policy check failed - please run 'pnpm run build:clean' to fix"
fi

echo ""
echo "📚 Build artifact policy setup complete!"
echo ""
echo "Available commands:"
echo "  pnpm run build:clean   - Clean build (recommended)"
echo "  pnpm run build:check   - Verify policy compliance" 
echo "  pnpm run build:verify  - Verify build hashes"
echo ""
echo "Documentation: docs/BUILD_ARTIFACT_POLICY.md"