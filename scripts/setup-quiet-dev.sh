#!/bin/bash
# Setup quiet development environment
# This script creates the necessary environment configuration

echo "🔧 Setting up quiet development environment..."

# Create .env.development.local if it doesn't exist
if [ ! -f ".env.development.local" ]; then
  cat > .env.development.local << 'EOF'
# Development Environment Configuration
# This file is loaded in development mode and overrides .env.development

# Database Logging - Quiet Mode
DB_LOG_LEVEL=ERROR
DB_LOGGING=false
DB_LOG_QUERY_PARAMS=false
DB_LOG_PERFORMANCE=false
DB_MAX_QUERY_LOG_LENGTH=50

# General Logging
LOG_LEVEL=warn

# Node Environment
NODE_ENV=development
EOF
  echo "✅ Created .env.development.local"
else
  echo "ℹ️  .env.development.local already exists"
fi

echo ""
echo "🎯 To use quiet development mode:"
echo "  1. Restart your development server"
echo "  2. Or run: source scripts/quiet-dev.sh && pnpm dev"
echo ""
echo "📊 This will reduce terminal noise by:"
echo "  - Only showing database errors (not every query)"
echo "  - Disabling query parameter logging"
echo "  - Reducing log verbosity to warnings and errors only"
