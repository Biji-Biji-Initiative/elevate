#!/bin/bash

# Deploy Web App to Vercel
# Usage: ./scripts/deploy-web.sh [staging|production]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_APP_PATH="$PROJECT_ROOT"
ENVIRONMENT="${1:-staging}"

# Vercel project IDs (these should be set as environment variables)
WEB_PROJECT_ID="${VERCEL_WEB_PROJECT_ID:-}"
WEB_ORG_ID="${VERCEL_WEB_ORG_ID:-}"

echo -e "${BLUE}🚀 Deploying Web App to Vercel ($ENVIRONMENT)${NC}"
echo "Project Root: $PROJECT_ROOT"
echo "Environment: $ENVIRONMENT"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Please install it first:${NC}"
    echo "npm i -g vercel"
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    echo -e "${RED}❌ Not in project root directory${NC}"
    exit 1
fi

# Check for required environment variables in production
if [[ "$ENVIRONMENT" == "production" ]]; then
    if [[ -z "$WEB_PROJECT_ID" || -z "$WEB_ORG_ID" ]]; then
        echo -e "${YELLOW}⚠️  Warning: VERCEL_WEB_PROJECT_ID and VERCEL_WEB_ORG_ID not set${NC}"
        echo "These should be configured for production deployments"
    fi
fi

# Navigate to project root
cd "$PROJECT_ROOT"

# Pre-deployment checks
echo -e "${BLUE}🔍 Running pre-deployment checks...${NC}"

# Check if database can be accessed
echo "Checking database connection..."
if ! pnpm db:generate > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Database schema generation failed, but continuing...${NC}"
fi

# Type checking
echo "Running type checks..."
if ! pnpm -F web type-check; then
    echo -e "${RED}❌ Type check failed for web app${NC}"
    exit 1
fi

# Linting
echo "Running linter..."
if ! pnpm -F web lint; then
    echo -e "${RED}❌ Linting failed for web app${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"

# Build command
echo -e "${BLUE}🔨 Building web app...${NC}"
if ! pnpm turbo run build --filter=web; then
    echo -e "${RED}❌ Build failed for web app${NC}"
    exit 1
fi

# Deploy to Vercel
echo -e "${BLUE}🚀 Deploying to Vercel...${NC}"

DEPLOY_ARGS=()

if [[ "$ENVIRONMENT" == "production" ]]; then
    DEPLOY_ARGS+=("--prod")
    echo "Deploying to production..."
else
    echo "Deploying to preview (staging)..."
fi

# Add project and org ID if available
if [[ -n "$WEB_PROJECT_ID" ]]; then
    DEPLOY_ARGS+=("--scope" "$WEB_ORG_ID")
fi

# Deploy
if vercel deploy "${DEPLOY_ARGS[@]}" --yes; then
    echo -e "${GREEN}✅ Web app deployment successful!${NC}"
    
    # Get deployment URL
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo -e "${GREEN}🌐 Production URL: https://leaps.mereka.org${NC}"
    else
        DEPLOYMENT_URL=$(vercel ls --scope="$WEB_ORG_ID" 2>/dev/null | head -2 | tail -1 | awk '{print $2}' || echo "Check Vercel dashboard for URL")
        echo -e "${GREEN}🌐 Preview URL: $DEPLOYMENT_URL${NC}"
    fi
    
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Web app deployment completed successfully!${NC}"