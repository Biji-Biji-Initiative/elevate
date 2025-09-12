#!/usr/bin/env bash
set -euo pipefail

# Run Kajabi-related tests end-to-end against Supabase Local
# - Sync DB env into Prisma
# - Push schema (no migrate dev)
# - Build packages
# - Run logic unit tests and integration tests (webhook)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[kajabi-tests] Repo root: $ROOT_DIR"

# Default to Supabase Local if not set
if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
  echo "[kajabi-tests] DATABASE_URL not set. Defaulting to Supabase Local (54322)"
fi

if [[ -z "${DIRECT_URL:-}" ]]; then
  export DIRECT_URL="$DATABASE_URL"
  echo "[kajabi-tests] DIRECT_URL not set. Using DATABASE_URL"
fi

# Ensure Kajabi tags are configured for tests
export KAJABI_LEARN_TAGS="${KAJABI_LEARN_TAGS:-LEARN_COMPLETED}"
echo "[kajabi-tests] KAJABI_LEARN_TAGS=$KAJABI_LEARN_TAGS"

echo "[kajabi-tests] Syncing DB env to Prisma (.env in packages/db)"
pnpm node scripts/env/sync-db-env-to-prisma.mjs

echo "[kajabi-tests] Pushing schema to DB (no migrate dev)"
pnpm db:push

echo "[kajabi-tests] Building all workspace packages (@elevate/*)"
pnpm -r --filter "@elevate/*" run build

echo "[kajabi-tests] Running logic unit tests (kajabi)"
pnpm -F @elevate/logic vitest run src/__tests__/kajabi.test.ts

echo "[kajabi-tests] Running integration test (webhook route)"
pnpm vitest --config vitest.config.ts run tests/integration/02-kajabi-webhook-integration.test.ts

echo "[kajabi-tests] All Kajabi tests completed"

