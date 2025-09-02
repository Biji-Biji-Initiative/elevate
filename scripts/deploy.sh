#!/usr/bin/env bash

# MS Elevate LEAPS Tracker Deployment Script

set -euo pipefail

# This script handles deployment to Vercel with proper environment setup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if environment is specified
ENVIRONMENT=${1:-staging}

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_error "Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

print_status "Deploying MS Elevate LEAPS Tracker to $ENVIRONMENT..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed. Run: npm install -g vercel"
    exit 1
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    print_error "Not logged in to Vercel. Run: vercel login"
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
pnpm install --frozen-lockfile

# Run type checking
print_status "Running type checks..."
pnpm run type-check || {
    print_error "Type checking failed. Fix errors before deploying."
    exit 1
}

# Run linting
print_status "Running linter..."
pnpm run lint || {
    print_warning "Linting issues found. Consider fixing them."
}

# Build applications
print_status "Building applications..."
pnpm run build || {
    print_error "Build failed. Check errors above."
    exit 1
}

# Run database migrations for production
if [ "$ENVIRONMENT" = "production" ]; then
    print_status "Running database migrations..."
    pnpm run db:migrate:prod || {
        print_error "Database migration failed."
        exit 1
    }
fi

# Deploy to Vercel
print_status "Deploying to Vercel ($ENVIRONMENT)..."

if [ "$ENVIRONMENT" = "production" ]; then
    vercel --prod --yes || {
        print_error "Production deployment failed."
        exit 1
    }
else
    vercel --yes || {
        print_error "Staging deployment failed."
        exit 1
    }
fi

# Wait for deployment to be ready
print_status "Waiting for deployment to be ready..."
sleep 30

# Run post-deployment checks
print_status "Running post-deployment health checks..."

if [ "$ENVIRONMENT" = "production" ]; then
    HEALTH_URL="https://leaps.mereka.org/api/health"
else
    # Get the preview URL from Vercel
    PREVIEW_URL=$(vercel ls elevate-monorepo --meta | grep https | head -1 | awk '{print $2}')
    HEALTH_URL="$PREVIEW_URL/api/health"
fi

# Check health endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    print_success "Health check passed!"
else
    print_warning "Health check returned status: $HTTP_STATUS"
fi

# Refresh materialized views for production
if [ "$ENVIRONMENT" = "production" ]; then
    print_status "Refreshing materialized views..."
    curl -s "$HEALTH_URL/../cron/refresh-leaderboards" \
        -H "Authorization: Bearer $CRON_SECRET" \
        > /dev/null || print_warning "Could not refresh materialized views"
fi

print_success "Deployment to $ENVIRONMENT completed successfully!"

if [ "$ENVIRONMENT" = "production" ]; then
    print_status "Production URL: https://leaps.mereka.org"
    print_status "Admin URL: https://leaps.mereka.org/admin"
else
    print_status "Staging URL: $PREVIEW_URL"
    print_status "Admin URL: $PREVIEW_URL/admin"
fi

print_status "Don't forget to:"
echo "  1. Test critical user flows"
echo "  2. Verify webhook endpoints"
echo "  3. Check email delivery"
echo "  4. Monitor error rates"

exit 0