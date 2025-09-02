#!/bin/bash

# Deploy Both Web and Admin Apps to Vercel
# Usage: ./scripts/deploy-all.sh [staging|production]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${1:-staging}"

echo -e "${BLUE}🚀 Deploying Both Apps to Vercel ($ENVIRONMENT)${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "Environment: $ENVIRONMENT"

# Check if scripts exist
if [[ ! -f "$SCRIPT_DIR/deploy-web.sh" ]]; then
    echo -e "${RED}❌ deploy-web.sh not found${NC}"
    exit 1
fi

if [[ ! -f "$SCRIPT_DIR/deploy-admin.sh" ]]; then
    echo -e "${RED}❌ deploy-admin.sh not found${NC}"
    exit 1
fi

# Global pre-deployment checks
echo -e "${BLUE}🔍 Running global pre-deployment checks...${NC}"
cd "$PROJECT_ROOT"

# Check if we have the required tools
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Please install it first:${NC}"
    echo "npm i -g vercel"
    exit 1
fi

# Check if we're authenticated with Vercel
if ! vercel whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Not authenticated with Vercel. Please run 'vercel login' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Global checks passed${NC}"

# Deploy web app first
echo -e "\n${BLUE}📦 Step 1: Deploying Web App${NC}"
echo "=================================================="
if ! "$SCRIPT_DIR/deploy-web.sh" "$ENVIRONMENT"; then
    echo -e "${RED}❌ Web app deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Web app deployment completed${NC}"

# Small delay between deployments
sleep 2

# Deploy admin app
echo -e "\n${BLUE}📦 Step 2: Deploying Admin App${NC}"
echo "=================================================="
if ! "$SCRIPT_DIR/deploy-admin.sh" "$ENVIRONMENT"; then
    echo -e "${RED}❌ Admin app deployment failed${NC}"
    echo -e "${YELLOW}⚠️  Note: Web app was deployed successfully${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Admin app deployment completed${NC}"

# Summary
echo -e "\n${GREEN}🎉 All deployments completed successfully!${NC}"
echo "=================================================="

if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "${GREEN}🌐 Web App: https://leaps.mereka.org${NC}"
    echo -e "${GREEN}🌐 Admin App: https://admin.leaps.mereka.org${NC}"
else
    echo -e "${GREEN}🌐 Both apps deployed to preview environments${NC}"
    echo -e "${BLUE}💡 Check Vercel dashboard for exact URLs${NC}"
fi

echo -e "\n${BLUE}📋 Post-deployment checklist:${NC}"
echo "1. ✅ Verify both applications are accessible"
echo "2. ✅ Test authentication flows"
echo "3. ✅ Check database connections"
echo "4. ✅ Verify environment variables"
echo "5. ✅ Test critical user journeys"

if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "\n${YELLOW}⚠️  Production deployment complete. Monitor for any issues.${NC}"
fi