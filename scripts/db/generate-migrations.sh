#!/bin/bash

# Generate SQL migrations from Prisma schema
# This script creates Supabase-compatible migrations from the canonical Prisma schema

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PRISMA_SCHEMA="packages/db/schema.prisma"
MIGRATION_NAME="${1:-prisma_sync_$(date +%Y%m%d_%H%M%S)}"
SUPABASE_MIGRATIONS_DIR="supabase/migrations"

echo -e "${GREEN}🔄 Generating SQL migrations from Prisma schema...${NC}"

# Check if Prisma schema exists
if [[ ! -f "$PRISMA_SCHEMA" ]]; then
    echo -e "${RED}❌ Error: Prisma schema not found at $PRISMA_SCHEMA${NC}"
    exit 1
fi

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI not found. Please install it first.${NC}"
    echo "Run: npm install -g supabase"
    exit 1
fi

# Create migrations directory if it doesn't exist
mkdir -p "$SUPABASE_MIGRATIONS_DIR"

# Generate migration name with timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$SUPABASE_MIGRATIONS_DIR/${TIMESTAMP}_${MIGRATION_NAME}.sql"

echo -e "${YELLOW}📝 Creating migration: $MIGRATION_FILE${NC}"

# Use Prisma to generate SQL DDL
echo "-- Migration generated from Prisma schema at $(date)" > "$MIGRATION_FILE"
echo "-- Schema file: $PRISMA_SCHEMA" >> "$MIGRATION_FILE"
echo "" >> "$MIGRATION_FILE"

# Generate the SQL using prisma migrate diff
if npx prisma migrate diff \
    --from-empty \
    --to-schema-datamodel "$PRISMA_SCHEMA" \
    --script >> "$MIGRATION_FILE" 2>/dev/null; then
    
    echo -e "${GREEN}✅ Migration generated successfully${NC}"
    echo -e "📄 File: $MIGRATION_FILE"
    
    # Show the generated migration
    echo -e "${YELLOW}📋 Generated migration content:${NC}"
    head -20 "$MIGRATION_FILE"
    
    if [[ $(wc -l < "$MIGRATION_FILE") -gt 20 ]]; then
        echo "... (truncated, see full file for complete migration)"
    fi
    
else
    echo -e "${RED}❌ Error generating migration${NC}"
    rm -f "$MIGRATION_FILE"
    exit 1
fi

# Optional: Apply migration to local Supabase
read -p "Apply this migration to local Supabase? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚀 Applying migration to local Supabase...${NC}"
    if supabase db reset --linked=false; then
        echo -e "${GREEN}✅ Migration applied successfully${NC}"
    else
        echo -e "${RED}❌ Error applying migration${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}🎉 Migration generation completed!${NC}"
echo -e "Next steps:"
echo -e "1. Review the generated migration: $MIGRATION_FILE"
echo -e "2. Test the migration: supabase db reset"
echo -e "3. Commit the migration file to version control"