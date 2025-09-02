#!/bin/bash

# Generate Supabase migrations from Prisma schema
# This script ensures Supabase migrations stay in sync with the canonical Prisma schema

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRISMA_SCHEMA="packages/db/schema.prisma"
SUPABASE_MIGRATIONS_DIR="supabase/migrations"
MIGRATION_NAME="${1:-sync_from_prisma}"

echo -e "${BLUE}🔄 Syncing Supabase migrations from Prisma schema...${NC}"

# Check prerequisites
if [[ ! -f "$PRISMA_SCHEMA" ]]; then
    echo -e "${RED}❌ Error: Prisma schema not found at $PRISMA_SCHEMA${NC}"
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI not found. Please install it first.${NC}"
    exit 1
fi

# Ensure migrations directory exists
mkdir -p "$SUPABASE_MIGRATIONS_DIR"

# Get current Supabase schema state
echo -e "${YELLOW}🔍 Getting current Supabase schema state...${NC}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

CURRENT_SCHEMA="$TEMP_DIR/current.sql"

# Export current Supabase schema
if supabase db dump --schema-only -f "$CURRENT_SCHEMA" 2>/dev/null; then
    echo -e "${GREEN}✅ Current schema exported${NC}"
else
    echo -e "${YELLOW}⚠️  No existing schema found, treating as fresh setup${NC}"
    touch "$CURRENT_SCHEMA"
fi

# Generate target schema from Prisma
echo -e "${YELLOW}🔄 Generating target schema from Prisma...${NC}"
TARGET_SCHEMA="$TEMP_DIR/target.sql"

# Create a temporary database URL for schema generation
TEMP_DB_URL="postgresql://temp:temp@localhost:5432/temp"

# Generate SQL from Prisma schema
npx prisma migrate diff \
    --from-empty \
    --to-schema-datamodel "$PRISMA_SCHEMA" \
    --script > "$TARGET_SCHEMA"

# Calculate the difference
echo -e "${YELLOW}🔍 Calculating schema differences...${NC}"
DIFF_FILE="$TEMP_DIR/diff.sql"

# Use Supabase to generate the migration
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_FILE="$SUPABASE_MIGRATIONS_DIR/${TIMESTAMP}_${MIGRATION_NAME}.sql"

# Create the migration header
cat > "$MIGRATION_FILE" << EOF
-- Migration: $MIGRATION_NAME
-- Generated: $(date)
-- Source: Prisma schema sync
-- This migration brings Supabase schema in sync with Prisma

EOF

# Add the schema changes
cat "$TARGET_SCHEMA" >> "$MIGRATION_FILE"

# Add RLS policies and other Supabase-specific features
cat >> "$MIGRATION_FILE" << 'EOF'

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE earned_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE kajabi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create materialized views for performance
CREATE OR REPLACE VIEW leaderboard_totals AS
SELECT 
    u.id,
    u.handle,
    u.name,
    u.school,
    u.cohort,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.id) as submission_count,
    MAX(s.updated_at) as last_activity
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id AND s.status = 'APPROVED'
GROUP BY u.id, u.handle, u.name, u.school, u.cohort
ORDER BY total_points DESC;

CREATE OR REPLACE VIEW leaderboard_30d AS
SELECT 
    u.id,
    u.handle,
    u.name,
    u.school,
    u.cohort,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.id) as submission_count
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id 
    AND pl.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN submissions s ON u.id = s.user_id 
    AND s.status = 'APPROVED' 
    AND s.updated_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.handle, u.name, u.school, u.cohort
ORDER BY total_points DESC;

CREATE OR REPLACE VIEW metric_counts AS
SELECT 
    a.code as activity_code,
    a.name as activity_name,
    COUNT(s.id) as total_submissions,
    COUNT(CASE WHEN s.status = 'PENDING' THEN 1 END) as pending_count,
    COUNT(CASE WHEN s.status = 'APPROVED' THEN 1 END) as approved_count,
    COUNT(CASE WHEN s.status = 'REJECTED' THEN 1 END) as rejected_count
FROM activities a
LEFT JOIN submissions s ON a.code = s.activity_code
GROUP BY a.code, a.name
ORDER BY a.code;
EOF

echo -e "${GREEN}✅ Migration generated: $MIGRATION_FILE${NC}"

# Validate the migration
echo -e "${YELLOW}🔍 Validating migration syntax...${NC}"
if supabase migration repair --status "$MIGRATION_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Migration syntax is valid${NC}"
else
    echo -e "${YELLOW}⚠️  Migration validation skipped (requires Supabase project)${NC}"
fi

# Show summary
echo
echo -e "${BLUE}📋 Migration Summary:${NC}"
echo -e "  📄 Source: $PRISMA_SCHEMA"
echo -e "  📁 Output: $MIGRATION_FILE"
echo -e "  📊 Size: $(wc -l < "$MIGRATION_FILE") lines"

# Ask if user wants to apply the migration
if [[ "${2:-}" != "--no-apply" ]]; then
    echo
    read -p "Apply this migration to local Supabase? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🚀 Applying migration...${NC}"
        if supabase db reset; then
            echo -e "${GREEN}✅ Migration applied successfully${NC}"
        else
            echo -e "${RED}❌ Error applying migration${NC}"
            exit 1
        fi
    fi
fi

echo -e "${GREEN}🎉 Supabase sync completed!${NC}"
echo -e "Next steps:"
echo -e "1. Review the generated migration"
echo -e "2. Test locally: supabase db reset"
echo -e "3. Deploy to staging: supabase db push --linked"
echo -e "4. Deploy to production after testing"