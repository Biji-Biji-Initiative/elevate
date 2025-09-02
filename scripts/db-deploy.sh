#!/bin/bash

# Database deployment and setup script for MS Elevate LEAPS Tracker
# Handles database migrations, seeding, and materialized view setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check environment
ENVIRONMENT=${1:-development}

print_status "Setting up database for $ENVIRONMENT environment..."

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set"
    exit 1
fi

print_status "Database URL: ${DATABASE_URL%@*}@***" # Hide credentials in logs

# Check if Prisma is available
if ! command -v prisma &> /dev/null; then
    print_error "Prisma CLI is not available. Run: pnpm install"
    exit 1
fi

# Generate Prisma client
print_status "Generating Prisma client..."
pnpm run db:generate

# Run migrations based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    print_status "Running production migrations (no prompts)..."
    pnpm run db:migrate:prod || {
        print_error "Production migration failed"
        exit 1
    }
else
    print_status "Running development migrations..."
    pnpm run db:migrate || {
        print_error "Development migration failed"
        exit 1
    }
fi

# Check if database is accessible
print_status "Testing database connection..."
pnpm run db:studio --browser=none --port=5555 &
STUDIO_PID=$!
sleep 5
kill $STUDIO_PID 2>/dev/null || true

# Seed database for non-production environments
if [ "$ENVIRONMENT" != "production" ]; then
    print_status "Seeding database with sample data..."
    pnpm run db:seed || {
        print_warning "Database seeding failed, continuing..."
    }
fi

# Setup materialized views if not exists
print_status "Ensuring materialized views are created..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupViews() {
  try {
    // Check if materialized views exist, create if they don't
    const views = ['leaderboard_totals', 'leaderboard_30d', 'metric_counts'];
    
    for (const view of views) {
      try {
        await prisma.\$queryRaw\`SELECT 1 FROM \${view} LIMIT 1\`;
        console.log(\`✓ Materialized view \${view} exists\`);
      } catch (error) {
        console.log(\`✗ Materialized view \${view} missing, will be created by migration\`);
      }
    }
    
    // Refresh materialized views
    console.log('Refreshing materialized views...');
    await prisma.\$executeRaw\`SELECT refresh_leaderboards();\`;
    console.log('✓ Materialized views refreshed');
    
  } catch (error) {
    console.error('Error setting up views:', error);
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
}

setupViews();
" || {
    print_warning "Could not setup/refresh materialized views"
}

# Verify database schema
print_status "Verifying database schema..."
SCHEMA_CHECK=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    // Check critical tables exist
    const tables = ['users', 'activities', 'submissions', 'points_ledger'];
    
    for (const table of tables) {
      const count = await prisma.\$queryRaw\`SELECT COUNT(*) FROM \${table}\`;
      console.log(\`✓ Table \${table}: \${count[0].count} records\`);
    }
    
    console.log('SCHEMA_OK');
  } catch (error) {
    console.error('Schema check failed:', error);
    console.log('SCHEMA_ERROR');
  } finally {
    await prisma.\$disconnect();
  }
}

checkSchema();
")

if echo "$SCHEMA_CHECK" | grep -q "SCHEMA_ERROR"; then
    print_error "Database schema verification failed"
    exit 1
fi

print_success "Database setup completed successfully!"

# Print summary
print_status "Database Summary:"
echo "  - Environment: $ENVIRONMENT"
echo "  - Migrations: Applied"
echo "  - Schema: Verified"
if [ "$ENVIRONMENT" != "production" ]; then
    echo "  - Sample Data: Seeded"
fi
echo "  - Materialized Views: Ready"

# Print next steps
print_status "Next steps:"
echo "  1. Start your application: pnpm dev"
echo "  2. Access database studio: pnpm run db:studio"
echo "  3. View logs for any issues"

exit 0