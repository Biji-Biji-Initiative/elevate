#!/bin/bash

# Cache Cleanup Script for MS Elevate LEAPS Tracker
# Provides various cache cleanup options for optimal performance

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

# Function to get current cache stats
get_cache_stats() {
    local cache_entries=0
    local cache_size="0B"
    
    if [[ -d ".turbo/cache" ]]; then
        cache_entries=$(find .turbo/cache -type f 2>/dev/null | wc -l | tr -d ' ')
        cache_size=$(du -sh .turbo/cache 2>/dev/null | cut -f1 || echo "0B")
    fi
    
    echo "$cache_entries,$cache_size"
}

# Function to clean local cache
clean_local_cache() {
    local before_stats=$(get_cache_stats)
    local before_entries=$(echo "$before_stats" | cut -d',' -f1)
    local before_size=$(echo "$before_stats" | cut -d',' -f2)
    
    log "Current cache: $before_entries entries ($before_size)"
    
    if [[ -d ".turbo/cache" ]]; then
        warning "This will remove all local cache entries"
        read -p "Continue? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf .turbo/cache/*
            success "Local cache cleared"
            log "Freed: $before_size of disk space"
        else
            log "Cache cleanup cancelled"
        fi
    else
        warning "No cache directory found"
    fi
}

# Function to clean old cache entries
clean_old_cache() {
    local days=${1:-7}
    
    log "Cleaning cache entries older than $days days..."
    
    if [[ -d ".turbo/cache" ]]; then
        local before_stats=$(get_cache_stats)
        local before_entries=$(echo "$before_stats" | cut -d',' -f1)
        
        # Find and remove old entries
        find .turbo/cache -type f -mtime +$days -delete 2>/dev/null || true
        
        local after_stats=$(get_cache_stats)
        local after_entries=$(echo "$after_stats" | cut -d',' -f1)
        local cleaned=$((before_entries - after_entries))
        
        success "Cleaned $cleaned old cache entries"
    else
        warning "No cache directory found"
    fi
}

# Function to analyze cache contents
analyze_cache() {
    if [[ -d ".turbo/cache" ]]; then
        header "📊 Cache Analysis"
        echo ""
        
        log "Cache contents by age:"
        find .turbo/cache -type f -exec stat -f "%m %N" {} \; 2>/dev/null | \
        sort -nr | \
        head -10 | \
        while read timestamp file; do
            date -r "$timestamp" "+%Y-%m-%d %H:%M" | tr -d '\n'
            echo " - $(basename "$file")"
        done
        
        echo ""
        log "Cache size distribution:"
        find .turbo/cache -type f -exec ls -lh {} \; 2>/dev/null | \
        awk '{print $5}' | \
        sort | \
        uniq -c | \
        sort -nr | \
        head -5
        
        echo ""
        log "Total cache statistics:"
        local stats=$(get_cache_stats)
        local entries=$(echo "$stats" | cut -d',' -f1)
        local size=$(echo "$stats" | cut -d',' -f2)
        echo "  Entries: $entries"
        echo "  Size: $size"
    else
        warning "No cache directory found for analysis"
    fi
}

# Function to verify cache integrity
verify_cache() {
    log "Verifying cache integrity..."
    
    if [[ -d ".turbo/cache" ]]; then
        local corrupt_files=0
        local total_files=0
        
        while IFS= read -r -d '' file; do
            ((total_files++))
            if [[ ! -r "$file" ]] || [[ ! -s "$file" ]]; then
                ((corrupt_files++))
                warning "Corrupt or empty cache file: $(basename "$file")"
            fi
        done < <(find .turbo/cache -type f -print0 2>/dev/null)
        
        if [[ $corrupt_files -gt 0 ]]; then
            error "Found $corrupt_files corrupt files out of $total_files total"
            echo "Consider running: $0 --clean to remove corrupt entries"
        else
            success "Cache integrity check passed ($total_files files)"
        fi
    else
        warning "No cache directory found"
    fi
}

# Function to optimize cache
optimize_cache() {
    log "Optimizing cache..."
    
    # Clean old entries (older than 14 days)
    clean_old_cache 14
    
    # Verify integrity
    verify_cache
    
    success "Cache optimization complete"
}

# Function to show cache usage recommendations
show_recommendations() {
    local stats=$(get_cache_stats)
    local entries=$(echo "$stats" | cut -d',' -f1)
    local size=$(echo "$stats" | cut -d',' -f2)
    
    header "💡 Cache Usage Recommendations"
    echo ""
    
    if [[ $entries -eq 0 ]]; then
        warning "Empty cache - run builds to populate"
        echo "  pnpm turbo run build lint typecheck test"
    elif [[ $entries -lt 10 ]]; then
        log "Small cache - consider running more tasks"
        echo "  pnpm turbo run build --filter=..."
    elif [[ $entries -gt 100 ]]; then
        warning "Large cache ($entries entries) - consider cleanup"
        echo "  $0 --old 7  # Clean entries older than 7 days"
    else
        success "Healthy cache size ($entries entries)"
    fi
    
    echo ""
    echo "Cache maintenance schedule:"
    echo "  • Weekly: $0 --old 7"
    echo "  • Monthly: $0 --clean (full cleanup)"
    echo "  • Before releases: $0 --verify"
}

# Main execution
main() {
    header "🧹 Turbo Cache Cleanup for MS Elevate LEAPS Tracker"
    header "═══════════════════════════════════════════════════════"
    echo ""
    
    # Show current status
    local stats=$(get_cache_stats)
    local entries=$(echo "$stats" | cut -d',' -f1)
    local size=$(echo "$stats" | cut -d',' -f2)
    
    log "Current cache: $entries entries ($size)"
    echo ""
    
    # Interactive menu
    echo "Cache cleanup options:"
    echo "1) Clean all cache entries"
    echo "2) Clean old cache entries (7+ days)"
    echo "3) Clean old cache entries (14+ days)"
    echo "4) Analyze cache contents"
    echo "5) Verify cache integrity"
    echo "6) Optimize cache (clean old + verify)"
    echo "7) Show recommendations"
    echo "q) Quit"
    echo ""
    
    read -p "Choose an option (1-7, q): " -r choice
    
    case $choice in
        1)
            clean_local_cache
            ;;
        2)
            clean_old_cache 7
            ;;
        3)
            clean_old_cache 14
            ;;
        4)
            analyze_cache
            ;;
        5)
            verify_cache
            ;;
        6)
            optimize_cache
            ;;
        7)
            show_recommendations
            ;;
        q|Q)
            log "Exiting cache cleanup"
            exit 0
            ;;
        *)
            error "Invalid option: $choice"
            exit 1
            ;;
    esac
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h         Show this help message"
        echo "  --clean            Clean all cache entries"
        echo "  --old DAYS         Clean entries older than DAYS (default: 7)"
        echo "  --analyze          Analyze cache contents"
        echo "  --verify           Verify cache integrity"
        echo "  --optimize         Optimize cache (clean + verify)"
        echo "  --recommendations  Show cache usage recommendations"
        echo ""
        echo "Examples:"
        echo "  $0                    # Interactive mode"
        echo "  $0 --clean           # Clean all cache"
        echo "  $0 --old 7           # Clean entries older than 7 days"
        echo "  $0 --optimize        # Full optimization"
        exit 0
        ;;
    --clean)
        log "Cleaning all cache entries..."
        if [[ -d ".turbo/cache" ]]; then
            rm -rf .turbo/cache/*
            success "Local cache cleared"
        else
            warning "No cache directory found"
        fi
        exit 0
        ;;
    --old)
        days=${2:-7}
        clean_old_cache "$days"
        exit 0
        ;;
    --analyze)
        analyze_cache
        exit 0
        ;;
    --verify)
        verify_cache
        exit 0
        ;;
    --optimize)
        optimize_cache
        exit 0
        ;;
    --recommendations)
        show_recommendations
        exit 0
        ;;
    "")
        # No arguments - run interactive mode
        main "$@"
        ;;
    *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac