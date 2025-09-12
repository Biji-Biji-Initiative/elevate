#!/usr/bin/env bash

# One-shot local E2E validator for MS Elevate LEAPS
# - Boots Supabase Local (via CLI) if needed
# - Initializes DB schema + seed
# - Runs lint, type-check, unit/integration (Vitest), and E2E (Playwright)
# Usage: bash scripts/test-e2e-all.sh

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

log() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERROR]${NC} $*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

log "Validating required tools..."
require_cmd node
require_cmd pnpm
require_cmd supabase
ok "Tools present (node, pnpm, supabase)"

# Load env (prefer local overrides)
if [ -f .env.local ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | xargs) || true
fi

if [ -z "${DATABASE_URL:-}" ]; then
  warn "DATABASE_URL not set; defaulting to Supabase Local on 54322"
  export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
fi

# Provide sane defaults for test secrets if missing
export NODE_ENV=${NODE_ENV:-test}
export KAJABI_WEBHOOK_SECRET=${KAJABI_WEBHOOK_SECRET:-test-webhook-secret-123}
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-pk_test_dummy}
export CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-sk_test_dummy}

log "Checking Supabase Local status..."
if ! supabase status >/dev/null 2>&1; then
  log "Starting Supabase Local (this may take a minute)..."
  supabase start
fi
ok "Supabase Local is running"

# Optionally free common dev ports if requested
if [ "${KILL_PORTS:-true}" = "true" ]; then
  for PORT in 3000 3001 5000; do
    if command -v lsof >/dev/null 2>&1 && lsof -ti:$PORT >/dev/null 2>&1; then
      warn "Freeing port $PORT"
      lsof -ti:$PORT | xargs -r kill -9 || true
    fi
  done
fi

log "Waiting for database to accept connections..."
ATTEMPTS=0
until pnpm exec prisma db execute --stdin --schema=packages/db/schema.prisma <<< "SELECT 1;" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ "$ATTEMPTS" -gt 60 ]; then
    err "Database did not become ready in time"
    exit 1
  fi
  sleep 1
done
ok "Database is reachable"

log "Installing dependencies..."
pnpm install --frozen-lockfile || pnpm install

log "Building internal packages..."
pnpm -F @elevate/openapi generate:all || true
pnpm -r --filter @elevate/* run build || true

log "Initializing database schema and seed..."
# Ensure Prisma client is generated
pnpm db:generate
# Try prisma db push; if destructive changes detected, allow data loss in local test DB
set +e
PUSH_OUTPUT=$(pnpm exec prisma db push --schema=packages/db/schema.prisma 2>&1)
PUSH_CODE=$?
set -e
if [ "$PUSH_CODE" -ne 0 ] && echo "$PUSH_OUTPUT" | grep -qi "accept-data-loss"; then
  warn "Prisma requires --accept-data-loss; applying for local test database"
  pnpm exec prisma db push --schema=packages/db/schema.prisma --accept-data-loss
else
  echo "$PUSH_OUTPUT"
  if [ "$PUSH_CODE" -ne 0 ]; then
    err "Prisma db push failed"
    exit 1
  fi
fi

pnpm db:seed

if [ "${SKIP_ENV_VALIDATION:-false}" = "true" ]; then
  warn "Skipping environment validation (SKIP_ENV_VALIDATION=true)"
else
  log "Validating environment configuration..."
  pnpm env:validate || {
    warn "env:validate failed; set SKIP_ENV_VALIDATION=true to bypass for local tests"
    exit 1
  }
fi

log "Running lint and type-check..."
pnpm lint
pnpm type-check

log "Running unit/integration tests with coverage..."
pnpm exec vitest --config tests/vitest.config.ts run --coverage

log "Ensuring Playwright browsers are installed..."
if [ "$(uname -s)" = "Linux" ]; then
  pnpm exec playwright install --with-deps
else
  pnpm exec playwright install
fi

log "Running Playwright E2E tests..."
pnpm exec playwright test -c playwright.config.ts

ok "All test stages completed successfully"

echo
log "Artifacts and reports:"
echo "  • Coverage: elevate/coverage/"
echo "  • Playwright HTML: elevate/playwright-report/ (npx playwright show-report elevate/playwright-report)"
echo "  • Playwright traces: elevate/test-results/**/*.zip (npx playwright show-trace <zip>)"
echo
ok "Done"
