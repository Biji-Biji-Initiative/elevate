#!/bin/bash

# Apply referral migrations to the configured local database (Supabase Local or any PostgreSQL reachable via DATABASE_URL)
# Usage: ./scripts/db/apply-referrals-local.sh
# Requires: DATABASE_URL set in environment or .env.local

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Applying referral migrations to local database${NC}"

# Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${RED}❌ DATABASE_URL is not set. Set it or create .env.local${NC}"
  exit 1
fi

# Quick connectivity check
if ! pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma <<< "SELECT 1;" >/dev/null 2>&1; then
  echo -e "${RED}❌ Cannot connect to database at DATABASE_URL${NC}"
  echo -e "${YELLOW}💡 For Supabase Local: run 'supabase start' and ensure port 54322${NC}"
  exit 1
fi

echo -e "${YELLOW}📝 Applying referral migrations...${NC}"

echo -e "${YELLOW}  → Applying referral support migration...${NC}"
pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma << 'EOF'
-- Referral support: user columns and events table

-- Add referral columns to users
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code text UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Create referral_events table
CREATE TABLE IF NOT EXISTS referral_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  external_event_id text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency on referrer/referee/event_type
CREATE UNIQUE INDEX IF NOT EXISTS ux_referral_event_pair_event
  ON referral_events(referrer_user_id, referee_user_id, event_type);

CREATE INDEX IF NOT EXISTS ix_referrals_referrer_time
  ON referral_events(referrer_user_id, created_at);
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✅ Referral support migration applied${NC}"
else
    echo -e "${RED}  ❌ Referral support migration failed${NC}"
    exit 1
fi

echo -e "${YELLOW}  → Applying user type confirmation migration...${NC}"
pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma << 'EOF'
-- Track explicit confirmation of user_type
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type_confirmed boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Mark existing users as confirmed to avoid forcing legacy users through onboarding
UPDATE users SET user_type_confirmed = true WHERE user_type_confirmed IS NOT TRUE;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✅ User type confirmation migration applied${NC}"
else
    echo -e "${RED}  ❌ User type confirmation migration failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All referral migrations applied successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "  1. Regenerate Prisma client:"
echo -e "     ${GREEN}pnpm -C elevate -F @elevate/db prisma generate${NC}"
echo ""
echo -e "  2. (Optional) Rebuild OpenAPI package:"
echo -e "     ${GREEN}pnpm -C elevate -F @elevate/openapi build${NC}"
echo ""
echo -e "  3. Start your apps:"
echo -e "     ${GREEN}pnpm -C elevate dev:web${NC}"
echo -e "     ${GREEN}pnpm -C elevate dev:admin${NC}"
echo ""
echo -e "${YELLOW}🔗 Test referral flow:${NC}"
echo -e "  • Go to /{locale}/dashboard/amplify/invite to get referral link"
echo -e "  • Open link in fresh session → auto-redirect to sign-up"
echo -e "  • Complete sign-up → choose role → dashboard"
echo -e "  • Check admin referrals at /{locale}/referrals"
echo ""
