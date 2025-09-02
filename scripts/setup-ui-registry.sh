#!/bin/bash

# Setup UI Registry Script
# This script sets up the shadcn/ui registry for the Elevate project

set -e

echo "🎨 Setting up UI Registry for MS Elevate..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages/ui" ]; then
  echo "❌ Error: Please run this script from the project root"
  exit 1
fi

# Install dependencies for UI package
echo "📦 Installing UI package dependencies..."
cd packages/ui
pnpm install
cd ../..

# Build the UI package
echo "🔨 Building UI package..."
pnpm ui:build

# Verify component imports work
echo "🔍 Verifying component setup..."

# Check if components can be imported (basic smoke test)
cat > temp-test.js << 'EOF'
try {
  const pkg = require('./packages/ui/dist/index.js');
  if (pkg.Button && pkg.Card && pkg.cn) {
    console.log('✅ Core components exported successfully');
  } else {
    console.log('❌ Missing core component exports');
    process.exit(1);
  }
} catch (e) {
  console.log('❌ Error importing components:', e.message);
  process.exit(1);
}
EOF

node temp-test.js
rm temp-test.js

# Verify registry configuration
echo "🔧 Verifying registry configuration..."

if [ -f "registry.json" ] && [ -f "components.json" ]; then
  echo "✅ Registry files present"
else
  echo "❌ Missing registry configuration files"
  exit 1
fi

# Check app configurations
if [ -f "apps/web/components.json" ] && [ -f "apps/admin/components.json" ]; then
  echo "✅ App configurations present"
else
  echo "❌ Missing app component configurations"
  exit 1
fi

# Test CLI commands
echo "🧪 Testing CLI commands..."

# Check if shadcn CLI is available
if ! command -v shadcn >/dev/null 2>&1; then
  echo "⚠️  Warning: shadcn CLI not found. Installing..."
  npm install -g shadcn@latest
fi

echo "
🎉 UI Registry setup complete!

Available commands:
  pnpm ui:build         - Build the UI package
  pnpm ui:dev           - Watch mode development
  pnpm ui:add <comp>    - Add component to registry
  pnpm ui:add:web <comp> - Add to web app
  pnpm ui:add:admin <comp> - Add to admin app

Next steps:
1. Review the documentation: docs/ui-registry.md
2. Test components in your apps: pnpm dev
3. Add new components as needed

Happy coding! ✨
"