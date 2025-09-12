#!/usr/bin/env bash

# MS Elevate LEAPS Tracker - Setup Script
# This script sets up the development environment

set -euo pipefail  # Exit on any error, undefined variables, or pipe failures

echo "🚀 Setting up MS Elevate LEAPS Tracker..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Run 'npm install -g pnpm'" >&2; exit 1; }

# Check if .env.local files exist
if [ ! -f ".env.local" ]; then
    echo "⚠️  Root .env.local not found. Creating from example..."
    cp .env.example .env.local
    echo "📝 Please update .env.local with your actual values"
fi

if [ ! -f "apps/web/.env.local" ]; then
    echo "⚠️  Web app .env.local not found. Creating from example..."
    cp apps/web/.env.example apps/web/.env.local
    echo "📝 Please update apps/web/.env.local with your actual values"
fi

if [ ! -f "apps/admin/.env.local" ]; then
    echo "⚠️  Admin app .env.local not found. Creating from example..."
    cp apps/admin/.env.example apps/admin/.env.local
    echo "📝 Please update apps/admin/.env.local with your actual values"
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Generating Prisma client..."
pnpm db:generate

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env.local files with actual values"
echo "2. Set up the local database (Supabase Local via CLI):"
echo "   • Install Supabase CLI: https://supabase.com/docs/guides/local-development"
echo "   • Start local stack: 'supabase start' (uses port 54322 by default)"
echo "   • Ensure DATABASE_URL points to localhost:54322 in .env.local"
echo "3. Initialize the database: 'pnpm db:init'"
echo "4. Run 'pnpm dev' to start the development servers"
echo ""
echo "🔗 Apps will be available at:"
echo "   - Web app: http://localhost:3000"
echo "   - Admin app: http://localhost:3001"
echo ""
echo "💡 Need help? Check the documentation in /docs or CLAUDE.md"
