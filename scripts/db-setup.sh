#!/usr/bin/env bash

# Database Setup Script for MS Elevate LEAPS Tracker
# This script sets up the PostgreSQL database with all required tables and views

set -euo pipefail

echo "🗄️  Setting up MS Elevate LEAPS database..."

# Load environment variables
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Please check your .env.local file."
    exit 1
fi

echo "📊 Checking database connection..."

# Test database connection
if pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma <<< "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Cannot connect to database. Please check your DATABASE_URL and ensure PostgreSQL is running."
    echo "💡 For local development, try running: docker-compose up -d postgres"
    echo "💡 Wait a few seconds for PostgreSQL to start, then try this command again"
    exit 1
fi

echo "🔧 Pushing database schema..."
pnpm db:push

echo "🌱 Seeding initial data..."
pnpm db:seed

echo "📋 Creating materialized views..."
if [ -f "packages/db/migrations/002_views.sql" ]; then
    pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma < packages/db/migrations/002_views.sql
    echo "✅ Materialized views created"
else
    echo "⚠️  View migration file not found, skipping materialized views"
fi

echo "🔄 Refreshing materialized views..."
pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma <<< "SELECT refresh_leaderboards();" || echo "⚠️  Could not refresh views (function may not exist yet)"

echo "✅ Database setup complete!"
echo ""
echo "📊 Database Status:"
pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma <<< "
  SELECT 
    schemaname,
    tablename,
    attname as column_name,
    typname as type_name
  FROM pg_tables 
  JOIN pg_class ON pg_tables.tablename = pg_class.relname 
  JOIN pg_attribute ON pg_class.oid = pg_attribute.attrelid 
  JOIN pg_type ON pg_attribute.atttypid = pg_type.oid 
  WHERE schemaname = 'public' 
    AND attnum > 0 
    AND NOT attisdropped
  ORDER BY tablename, attnum;
" 2>/dev/null | head -20 || echo "Database is ready for use"

echo ""
echo "🎯 You can now:"
echo "   - Run 'pnpm dev' to start the development servers"
echo "   - Run 'pnpm db:studio' to open Prisma Studio"
echo "   - Check the leaderboard at http://localhost:3000/leaderboard"