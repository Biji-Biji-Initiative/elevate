#!/bin/bash

# Setup Turbo Remote Cache for the MS Elevate LEAPS Tracker
# This script configures Turbo to use Vercel Remote Cache for faster builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [[ ! -f "turbo.json" ]]; then
    error "This script must be run from the project root directory"
    exit 1
fi

# Function to setup Vercel Remote Cache
setup_vercel_cache() {
    log "Setting up Vercel Remote Cache..."
    
    # Check if TURBO_TOKEN is provided
    if [[ -z "$TURBO_TOKEN" ]]; then
        warning "TURBO_TOKEN environment variable is not set"
        echo ""
        echo "To enable Vercel Remote Cache, you need a Turbo token:"
        echo "1. Visit https://vercel.com/account/tokens"
        echo "2. Create a new token with scope 'Turborepo Remote Cache'"
        echo "3. Set the TURBO_TOKEN environment variable:"
        echo "   export TURBO_TOKEN='your-token-here'"
        echo "   # Or add it to your .env.local file"
        echo ""
        echo "Once you have the token, run this script again:"
        echo "   TURBO_TOKEN='your-token' $0"
        echo ""
        warning "Continuing with local cache configuration only..."
        return 1
    fi
    
    # Verify the token works
    log "Verifying Turbo token..."
    if ! command -v turbo &> /dev/null; then
        error "Turbo CLI is not installed. Please run 'pnpm install' first."
        exit 1
    fi
    
    # Test the connection
    if turbo login --token="$TURBO_TOKEN" > /dev/null 2>&1; then
        success "Turbo token verified successfully"
        
        # Enable remote caching
        log "Enabling remote caching..."
        turbo link || {
            error "Failed to link to Vercel remote cache"
            return 1
        }
        
        success "Vercel Remote Cache configured successfully!"
        echo ""
        echo "Remote cache is now enabled for:"
        echo "  • build"
        echo "  • lint" 
        echo "  • type-check"
        echo "  • test"
        echo ""
        
        return 0
    else
        error "Invalid Turbo token. Please check your token and try again."
        return 1
    fi
}

# Function to setup local cache configuration
setup_local_cache() {
    log "Setting up local cache configuration..."
    
    # Create .turbo directory if it doesn't exist
    mkdir -p .turbo
    
    # Create local config template
    cat > .turbo/config.json << 'EOF'
{
  "teamId": "",
  "apiUrl": "https://vercel.com/api",
  "loginUrl": "https://vercel.com",
  "teamSlug": ""
}
EOF
    
    success "Local cache configuration created at .turbo/config.json"
}

# Function to update environment template
update_env_template() {
    log "Updating environment template..."
    
    # Check if .env.example exists
    if [[ -f ".env.example" ]]; then
        # Add TURBO_TOKEN if not already present
        if ! grep -q "TURBO_TOKEN" .env.example; then
            echo "" >> .env.example
            echo "# Turbo Remote Cache" >> .env.example
            echo "# Get your token from https://vercel.com/account/tokens" >> .env.example
            echo "TURBO_TOKEN=" >> .env.example
            success "Added TURBO_TOKEN to .env.example"
        else
            log "TURBO_TOKEN already present in .env.example"
        fi
    else
        warning ".env.example not found, skipping environment template update"
    fi
}

# Function to show cache stats
show_cache_info() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "🚀 Turbo Remote Cache Setup Complete"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Configuration:"
    echo "  • Remote Cache: ${TURBO_TOKEN:+✅ Enabled}${TURBO_TOKEN:-❌ Disabled (no token)}"
    echo "  • Local Cache:  ✅ Enabled"
    echo "  • Signature:    ✅ Enabled"
    echo ""
    echo "Cached Tasks:"
    echo "  • build       - Next.js builds, TypeScript compilation"
    echo "  • lint        - ESLint checks"
    echo "  • type-check  - TypeScript type checking"
    echo "  • test        - Jest/Vitest test runs"
    echo ""
    echo "Benefits:"
    echo "  • Faster CI builds by sharing cache across runs"
    echo "  • Faster local development by sharing cache across team"
    echo "  • Reduced build times for unchanged code"
    echo ""
    
    if [[ -z "$TURBO_TOKEN" ]]; then
        echo "Next Steps:"
        echo "  1. Get a Turbo token: https://vercel.com/account/tokens"
        echo "  2. Add to your environment: export TURBO_TOKEN='your-token'"
        echo "  3. Run: TURBO_TOKEN='your-token' ./scripts/setup-remote-cache.sh"
        echo ""
    fi
    
    echo "Usage:"
    echo "  turbo build --summarize  # Build with cache summary"
    echo "  turbo lint               # Lint with caching"
    echo "  turbo type-check         # Type check with caching"
    echo ""
}

# Main execution
main() {
    echo "🔧 Setting up Turbo Remote Cache for MS Elevate LEAPS Tracker"
    echo ""
    
    # Always setup local cache configuration
    setup_local_cache
    
    # Try to setup Vercel remote cache if token is available
    if setup_vercel_cache; then
        log "Remote cache setup successful"
    else
        log "Falling back to local cache only"
    fi
    
    # Update environment template
    update_env_template
    
    # Show final information
    show_cache_info
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --check        Check current cache configuration"
        echo ""
        echo "Environment Variables:"
        echo "  TURBO_TOKEN    Token for Vercel Remote Cache (optional)"
        echo ""
        echo "Examples:"
        echo "  $0                                    # Setup with local cache"
        echo "  TURBO_TOKEN='your-token' $0          # Setup with remote cache"
        echo "  $0 --check                           # Check current config"
        exit 0
        ;;
    --check)
        echo "🔍 Checking Turbo cache configuration..."
        echo ""
        
        if [[ -f ".turbo/config.json" ]]; then
            success "Local cache configuration exists"
        else
            warning "Local cache configuration not found"
        fi
        
        if [[ -n "$TURBO_TOKEN" ]]; then
            success "TURBO_TOKEN is set"
            if turbo login --token="$TURBO_TOKEN" > /dev/null 2>&1; then
                success "Remote cache connection verified"
            else
                error "Remote cache connection failed"
            fi
        else
            warning "TURBO_TOKEN not set - remote cache disabled"
        fi
        
        echo ""
        echo "Current turbo.json configuration:"
        if command -v jq &> /dev/null; then
            jq '.remoteCache // "Remote cache not configured"' turbo.json
        else
            grep -A2 '"remoteCache"' turbo.json || echo "Remote cache not configured"
        fi
        exit 0
        ;;
esac

# Run main function
main "$@"