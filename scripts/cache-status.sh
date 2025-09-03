#!/bin/bash

# Cache Status Script for MS Elevate LEAPS Tracker
# Provides detailed information about Turbo cache status and performance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

header() {
    echo -e "${CYAN}$1${NC}"
}

# Check if we're in the correct directory
if [[ ! -f "turbo.json" ]]; then
    error "This script must be run from the project root directory"
    exit 1
fi

# Function to get cache size
get_cache_size() {
    if [[ -d ".turbo/cache" ]]; then
        du -sh .turbo/cache 2>/dev/null | cut -f1 || echo "0B"
    else
        echo "0B"
    fi
}

# Function to count cache entries
count_cache_entries() {
    if [[ -d ".turbo/cache" ]]; then
        find .turbo/cache -type f 2>/dev/null | wc -l | tr -d ' ' || echo "0"
    else
        echo "0"
    fi
}

# Function to check turbo version
check_turbo_version() {
    if command -v turbo &> /dev/null; then
        turbo --version 2>/dev/null || echo "unknown"
    else
        echo "not installed"
    fi
}

# Function to check remote cache status
check_remote_cache_status() {
    if [[ -n "$TURBO_TOKEN" ]]; then
        if turbo login --token="$TURBO_TOKEN" > /dev/null 2>&1; then
            echo "✅ Connected"
        else
            echo "❌ Connection failed"
        fi
    else
        echo "⚪ Not configured"
    fi
}

# Function to analyze turbo.json configuration
analyze_turbo_config() {
    if command -v jq &> /dev/null; then
        echo "Remote Cache: $(jq -r '.remoteCache // "Not configured"' turbo.json)"
        echo "Tasks with caching:"
        jq -r '.tasks | to_entries[] | select(.value.cache == true) | "  • \(.key)"' turbo.json
    else
        echo "jq not available - showing raw config:"
        grep -A5 '"remoteCache"' turbo.json || echo "Remote cache not configured"
    fi
}

# Function to get recent cache activity
get_recent_cache_activity() {
    if [[ -d ".turbo/cache" ]]; then
        echo "Recent cache entries (last 5):"
        find .turbo/cache -type f -exec ls -lt {} + 2>/dev/null | head -5 | while read -r line; do
            echo "  $line"
        done
    else
        echo "No cache directory found"
    fi
}

# Function to estimate cache performance impact
estimate_performance_impact() {
    local cache_entries=$(count_cache_entries)
    local cache_size=$(get_cache_size)
    
    if [[ $cache_entries -gt 0 ]]; then
        echo "Estimated impact based on current cache:"
        echo "  • Cache entries: $cache_entries"
        echo "  • Cache size: $cache_size"
        
        if [[ $cache_entries -gt 20 ]]; then
            echo "  • Build time savings: ~30-70% (substantial cache)"
        elif [[ $cache_entries -gt 5 ]]; then
            echo "  • Build time savings: ~15-40% (moderate cache)"
        else
            echo "  • Build time savings: ~5-15% (minimal cache)"
        fi
    else
        echo "No cache data available for performance estimation"
    fi
}

# Function to show cache recommendations
show_recommendations() {
    local remote_status=$(check_remote_cache_status)
    local cache_entries=$(count_cache_entries)
    
    echo "Recommendations:"
    
    if [[ "$remote_status" == "⚪ Not configured" ]]; then
        warning "Enable remote cache for better CI performance"
        echo "  Run: TURBO_TOKEN='your-token' ./scripts/setup-remote-cache.sh"
    fi
    
    if [[ $cache_entries -lt 5 ]]; then
        log "Build more tasks to populate cache"
        echo "  Run: pnpm turbo run build lint typecheck test"
    fi
    
    if [[ ! -f ".turbo/config.json" ]]; then
        warning "Local cache configuration missing"
        echo "  Run: ./scripts/setup-remote-cache.sh"
    fi
}

# Main execution
main() {
    header "🔍 Turbo Cache Status Report"
    header "═══════════════════════════════════════════"
    echo ""
    
    # Basic information
    header "📊 Basic Information"
    echo "Turbo Version: $(check_turbo_version)"
    echo "Node Version: $(node --version 2>/dev/null || echo 'not available')"
    echo "Project Root: $(pwd)"
    echo ""
    
    # Cache configuration
    header "⚙️ Cache Configuration"
    analyze_turbo_config
    echo ""
    
    # Cache status
    header "💾 Local Cache Status"
    echo "Cache Directory: $([[ -d '.turbo/cache' ]] && echo '✅ Exists' || echo '❌ Missing')"
    echo "Cache Entries: $(count_cache_entries)"
    echo "Cache Size: $(get_cache_size)"
    echo ""
    
    # Remote cache status
    header "☁️ Remote Cache Status"
    echo "TURBO_TOKEN: $([[ -n "$TURBO_TOKEN" ]] && echo '✅ Set' || echo '❌ Not set')"
    echo "TURBO_TEAM: $([[ -n "$TURBO_TEAM" ]] && echo "✅ Set ($TURBO_TEAM)" || echo '⚪ Not set (optional)')"
    echo "Remote Connection: $(check_remote_cache_status)"
    echo ""
    
    # Performance analysis
    header "📈 Performance Analysis"
    estimate_performance_impact
    echo ""
    
    # Recent activity
    header "🕒 Recent Activity"
    get_recent_cache_activity
    echo ""
    
    # Recommendations
    header "💡 Recommendations"
    show_recommendations
    echo ""
    
    header "🚀 Next Steps"
    echo "To improve cache performance:"
    echo "1. Enable remote cache: TURBO_TOKEN='token' ./scripts/setup-remote-cache.sh"
    echo "2. Run builds to populate cache: pnpm turbo run build --summarize"
    echo "3. Monitor with: ./scripts/cache-status.sh"
    echo "4. Clean cache if needed: pnpm turbo run build --force"
    echo ""
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --json         Output cache status in JSON format"
        echo "  --summary      Show summary only"
        echo ""
        echo "Examples:"
        echo "  $0                    # Full cache status report"
        echo "  $0 --summary         # Summary only"
        echo "  $0 --json           # JSON output for automation"
        exit 0
        ;;
    --json)
        # JSON output for automation
        jq -n \
            --arg turbo_version "$(check_turbo_version)" \
            --arg cache_entries "$(count_cache_entries)" \
            --arg cache_size "$(get_cache_size)" \
            --arg remote_status "$(check_remote_cache_status)" \
            --arg turbo_token_set "$([[ -n "$TURBO_TOKEN" ]] && echo 'true' || echo 'false')" \
            --arg turbo_team "${TURBO_TEAM:-}" \
            '{
                turbo_version: $turbo_version,
                cache: {
                    entries: ($cache_entries | tonumber),
                    size: $cache_size,
                    directory_exists: true
                },
                remote_cache: {
                    token_set: ($turbo_token_set == "true"),
                    team: $turbo_team,
                    status: $remote_status
                }
            }'
        exit 0
        ;;
    --summary)
        echo "Cache Summary:"
        echo "  Entries: $(count_cache_entries)"
        echo "  Size: $(get_cache_size)"
        echo "  Remote: $(check_remote_cache_status)"
        exit 0
        ;;
esac

# Run main function
main "$@"