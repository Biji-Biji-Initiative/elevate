#!/usr/bin/env bash

# Environment variables validation script

set -euo pipefail

# Ensures all required environment variables are properly configured

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Environment to check
ENVIRONMENT=${1:-development}

print_status "Checking environment variables for $ENVIRONMENT..."

# Normalize alias variables to avoid naming drift
if [ -z "${SUPABASE_URL:-}" ] && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
fi
if [ -z "${SUPABASE_SERVICE_ROLE:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  export SUPABASE_SERVICE_ROLE="$SUPABASE_SERVICE_ROLE_KEY"
fi

# Define required environment variables by category
declare -A REQUIRED_VARS
declare -A OPTIONAL_VARS

# Database
REQUIRED_VARS[DATABASE_URL]="PostgreSQL database connection string"

# Supabase
REQUIRED_VARS[SUPABASE_URL]="Supabase project URL"
REQUIRED_VARS[SUPABASE_SERVICE_ROLE]="Supabase service role key for server-side operations"

# Clerk Authentication  
REQUIRED_VARS[NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY]="Clerk publishable key for client-side auth"
REQUIRED_VARS[CLERK_SECRET_KEY]="Clerk secret key for server-side auth"

# Email Service
REQUIRED_VARS[RESEND_API_KEY]="Resend API key for sending emails"
OPTIONAL_VARS[FROM_EMAIL]="From email address (default: noreply@leaps.mereka.org)"
OPTIONAL_VARS[REPLY_TO_EMAIL]="Reply-to email address (default: support@leaps.mereka.org)"

# Integrations
REQUIRED_VARS[KAJABI_WEBHOOK_SECRET]="Secret for validating Kajabi webhooks"

# Application
REQUIRED_VARS[NEXT_PUBLIC_SITE_URL]="Public URL of the application"

# Production-only variables
if [ "$ENVIRONMENT" = "production" ]; then
    REQUIRED_VARS[CRON_SECRET]="Secret for protecting cron endpoints"
fi

# Optional development variables
if [ "$ENVIRONMENT" = "development" ]; then
    OPTIONAL_VARS[OPENAI_API_KEY]="OpenAI API key for Supabase AI features"
fi

# Check required variables
MISSING_COUNT=0
INVALID_COUNT=0

print_status "Checking required environment variables..."

for VAR in "${!REQUIRED_VARS[@]}"; do
    VALUE="${!VAR}"
    DESCRIPTION="${REQUIRED_VARS[$VAR]}"
    
    if [ -z "$VALUE" ]; then
        print_error "Missing: $VAR ($DESCRIPTION)"
        ((MISSING_COUNT++))
    else
        # Basic validation
        case $VAR in
            *URL)
                if [[ ! "$VALUE" =~ ^https?:// ]]; then
                    print_warning "Invalid format: $VAR should start with http:// or https://"
                    ((INVALID_COUNT++))
                else
                    print_success "✓ $VAR"
                fi
                ;;
            DATABASE_URL)
                if [[ ! "$VALUE" =~ ^postgresql:// ]]; then
                    print_warning "Invalid format: $VAR should start with postgresql://"
                    ((INVALID_COUNT++))
                else
                    print_success "✓ $VAR"
                fi
                ;;
            *_KEY|*_SECRET)
                if [ ${#VALUE} -lt 20 ]; then
                    print_warning "Suspicious: $VAR seems too short (${#VALUE} chars)"
                    ((INVALID_COUNT++))
                else
                    print_success "✓ $VAR"
                fi
                ;;
            *)
                print_success "✓ $VAR"
                ;;
        esac
    fi
done

# Check optional variables
print_status "Checking optional environment variables..."

for VAR in "${!OPTIONAL_VARS[@]}"; do
    VALUE="${!VAR}"
    DESCRIPTION="${OPTIONAL_VARS[$VAR]}"
    
    if [ -z "$VALUE" ]; then
        print_warning "Optional: $VAR not set ($DESCRIPTION)"
    else
        print_success "✓ $VAR (optional)"
    fi
done

# Specific validation checks
print_status "Running specific validation checks..."

# Check Supabase URL format
if [ -n "$SUPABASE_URL" ] && [[ ! "$SUPABASE_URL" =~ \.supabase\.co$ ]]; then
    print_warning "Supabase URL format looks unusual: $SUPABASE_URL"
fi

# Check Clerk keys match
if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ] && [[ ! "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" =~ ^pk_[a-z]+_ ]]; then
    print_warning "Clerk publishable key format looks unusual"
fi

if [ -n "$CLERK_SECRET_KEY" ] && [[ ! "$CLERK_SECRET_KEY" =~ ^sk_[a-z]+_ ]]; then
    print_warning "Clerk secret key format looks unusual"
fi

# Test database connection if possible
if [ -n "$DATABASE_URL" ] && command -v psql &> /dev/null; then
    print_status "Testing database connection..."
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        print_success "Database connection successful"
    else
        print_warning "Could not connect to database (may be network/firewall issue)"
    fi
fi

# Summary
echo ""
print_status "Environment Check Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Required variables: $((${#REQUIRED_VARS[@]} - MISSING_COUNT))/${#REQUIRED_VARS[@]} configured"
echo "  Optional variables: $((${#OPTIONAL_VARS[@]} - $(grep -c "Optional:" <<< "$OUTPUT" || echo 0)))/${#OPTIONAL_VARS[@]} configured"

if [ $MISSING_COUNT -gt 0 ]; then
    print_error "$MISSING_COUNT required environment variables are missing"
    exit 1
fi

if [ $INVALID_COUNT -gt 0 ]; then
    print_warning "$INVALID_COUNT environment variables have format issues"
    exit 2
fi

print_success "All environment variables are properly configured!"

# Create .env.example if it doesn't exist
if [ ! -f ".env.example" ]; then
    print_status "Creating .env.example file..."
    cat > .env.example << EOF
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elevate_leaps

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-publishable-key
CLERK_SECRET_KEY=sk_test_your-secret-key

# Email Service (Resend)
RESEND_API_KEY=re_your-api-key
FROM_EMAIL=MS Elevate <noreply@leaps.mereka.org>
REPLY_TO_EMAIL=support@leaps.mereka.org

# Integrations
KAJABI_WEBHOOK_SECRET=your-webhook-secret

# Application
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org

# Production only
CRON_SECRET=your-cron-secret

# Optional
OPENAI_API_KEY=sk-your-openai-key
EOF
    print_success "Created .env.example file"
fi

exit 0
