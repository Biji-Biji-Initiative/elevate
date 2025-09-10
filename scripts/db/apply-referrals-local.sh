#!/bin/bash

# Apply referral migrations to local Docker Postgres container
# Usage: ./scripts/db/apply-referrals-local.sh
# Override defaults: CONTAINER_NAME=your_container DB_NAME=your_db DB_USER=your_user ./scripts/db/apply-referrals-local.sh

set -euo pipefail

# Default values (can be overridden via environment)
CONTAINER_NAME=${CONTAINER_NAME:-elevate-postgres}
DB_NAME=${DB_NAME:-elevate_leaps}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Applying referral migrations to local Docker Postgres${NC}"
echo -e "${YELLOW}Container: ${CONTAINER_NAME}${NC}"
echo -e "${YELLOW}Database: ${DB_NAME}${NC}"
echo -e "${YELLOW}User: ${DB_USER}${NC}"
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if container exists
if ! docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}❌ Container '${CONTAINER_NAME}' not found.${NC}"
    echo -e "${YELLOW}💡 Make sure you're using the correct container name or start your Docker Compose setup.${NC}"
    exit 1
fi

# Start container if not running
if ! docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}🔄 Starting container '${CONTAINER_NAME}'...${NC}"
    docker start "${CONTAINER_NAME}" >/dev/null
    sleep 2
fi

# Wait for container to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
for i in {1..30}; do
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Database not ready after 30 seconds${NC}"
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✅ Database is ready${NC}"

# Apply migrations
echo -e "${YELLOW}📝 Applying referral migrations...${NC}"

# Migration 1: Referral support
echo -e "${YELLOW}  → Applying referral support migration...${NC}"
docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" << 'EOF'
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

# Migration 2: User type confirmation
echo -e "${YELLOW}  → Applying user type confirmation migration...${NC}"
docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" << 'EOF'
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