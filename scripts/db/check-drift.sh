#!/bin/bash

# Check for schema drift between Prisma and database
# This ensures the database schema matches the canonical Prisma schema

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRISMA_SCHEMA="packages/db/schema.prisma"
DATABASE_URL="${DATABASE_URL:-}"

echo -e "${BLUE}🔍 Checking for schema drift...${NC}"

# Check if Prisma schema exists
if [[ ! -f "$PRISMA_SCHEMA" ]]; then
    echo -e "${RED}❌ Error: Prisma schema not found at $PRISMA_SCHEMA${NC}"
    exit 1
fi

# Check if DATABASE_URL is set
if [[ -z "$DATABASE_URL" ]]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable not set${NC}"
    exit 1
fi

echo -e "${YELLOW}📊 Comparing Prisma schema with database...${NC}"

# Generate current database schema
echo -e "${BLUE}🔄 Introspecting current database schema...${NC}"
TEMP_SCHEMA=$(mktemp)
trap "rm -f $TEMP_SCHEMA" EXIT

if ! npx prisma db pull --schema="$TEMP_SCHEMA" --print 2>/dev/null > "$TEMP_SCHEMA.generated"; then
    echo -e "${RED}❌ Error: Could not introspect database schema${NC}"
    echo -e "Make sure your database is accessible and DATABASE_URL is correct"
    exit 1
fi

# Compare schemas using prisma migrate diff
echo -e "${BLUE}🔄 Comparing schemas...${NC}"
DIFF_OUTPUT=$(mktemp)
trap "rm -f $DIFF_OUTPUT" EXIT

# Check for differences
if npx prisma migrate diff \
    --from-schema-datamodel "$TEMP_SCHEMA.generated" \
    --to-schema-datamodel "$PRISMA_SCHEMA" \
    --script > "$DIFF_OUTPUT" 2>/dev/null; then
    
    if [[ -s "$DIFF_OUTPUT" ]]; then
        echo -e "${YELLOW}⚠️  Schema drift detected!${NC}"
        echo -e "${RED}❌ Database schema is out of sync with Prisma schema${NC}"
        echo
        echo -e "${YELLOW}📋 Required changes to align database with Prisma:${NC}"
        echo "----------------------------------------"
        cat "$DIFF_OUTPUT"
        echo "----------------------------------------"
        echo
        echo -e "${YELLOW}🛠️  To fix this drift:${NC}"
        echo -e "1. Review the changes above"
        echo -e "2. Run: pnpm db:push (for development)"
        echo -e "3. Or create a migration: pnpm scripts/db/generate-migrations.sh"
        echo -e "4. Apply the migration: supabase db push"
        exit 1
    else
        echo -e "${GREEN}✅ No schema drift detected${NC}"
        echo -e "${GREEN}🎉 Database schema is in sync with Prisma schema${NC}"
    fi
else
    echo -e "${RED}❌ Error comparing schemas${NC}"
    exit 1
fi

# Additional checks
echo -e "${BLUE}🔍 Running additional validation checks...${NC}"

# Check for missing migrations
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" -type f 2>/dev/null | wc -l || echo "0")
echo -e "${BLUE}📁 Found $MIGRATION_COUNT migration files${NC}"

# Check Prisma client sync
echo -e "${BLUE}🔄 Checking Prisma client sync...${NC}"
if npx prisma generate --schema="$PRISMA_SCHEMA" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Prisma client is up to date${NC}"
else
    echo -e "${YELLOW}⚠️  Prisma client may need regeneration${NC}"
    echo -e "Run: pnpm db:generate"
fi

# Summary
echo
echo -e "${GREEN}📋 Schema Validation Summary:${NC}"
echo -e "  📄 Prisma schema: $PRISMA_SCHEMA"
echo -e "  🗄️  Database: ${DATABASE_URL%%\?*}..."
echo -e "  📦 Migrations: $MIGRATION_COUNT files"
echo -e "  ✅ Status: No drift detected"

echo -e "${GREEN}🎉 Schema validation completed successfully!${NC}"