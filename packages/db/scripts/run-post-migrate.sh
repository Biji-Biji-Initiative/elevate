#!/bin/bash

# Post-Migration Script Runner
# This script executes CONCURRENTLY operations after Prisma migrations
# It must run outside of transaction blocks that Prisma uses

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POST_MIGRATE_SQL="$SCRIPT_DIR/post-migrate.sql"
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2  
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

# Check if DATABASE_URL is set
check_database_url() {
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL environment variable is not set"
        log_info "Please set DATABASE_URL to your PostgreSQL connection string"
        exit 1
    fi
}

# Test database connectivity
test_connection() {
    log_info "Testing database connection..."
    
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "Database connection successful"
            return 0
        else
            log_error "Failed to connect to database with psql"
            return 1
        fi
    elif command -v pg_isready >/dev/null 2>&1; then
        # Extract connection details for pg_isready
        if pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
            log_success "Database is ready"
            return 0
        else
            log_error "Database is not ready (pg_isready failed)"
            return 1
        fi
    else
        log_warn "Neither psql nor pg_isready found, skipping connection test"
        return 0
    fi
}

# Check if post-migrate.sql exists
check_sql_file() {
    if [[ ! -f "$POST_MIGRATE_SQL" ]]; then
        log_error "Post-migrate SQL file not found: $POST_MIGRATE_SQL"
        exit 1
    fi
    log_info "Found post-migrate SQL file: $POST_MIGRATE_SQL"
}

# Run the post-migration script with retries
run_post_migrate() {
    local attempt=1
    local max_attempts=$MAX_RETRIES
    
    log_info "Starting post-migration operations..."
    log_info "This may take several minutes for large databases"
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Attempt $attempt of $max_attempts"
        
        if psql "$DATABASE_URL" -f "$POST_MIGRATE_SQL" -v ON_ERROR_STOP=1 -q; then
            log_success "Post-migration operations completed successfully!"
            return 0
        else
            log_error "Attempt $attempt failed"
            
            if [[ $attempt -lt $max_attempts ]]; then
                log_warn "Retrying in $RETRY_DELAY seconds..."
                sleep $RETRY_DELAY
            fi
        fi
        
        ((attempt++))
    done
    
    log_error "All attempts failed. Post-migration operations could not be completed."
    log_error "Please check the database logs and try running manually:"
    log_error "  psql \$DATABASE_URL -f $POST_MIGRATE_SQL"
    return 1
}

# Check for concurrent index operations
check_concurrent_operations() {
    log_info "Checking for existing concurrent operations..."
    
    local concurrent_ops
    concurrent_ops=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM pg_stat_activity 
        WHERE query ILIKE '%CREATE INDEX CONCURRENTLY%' 
        AND state = 'active' 
        AND pid != pg_backend_pid();" 2>/dev/null || echo "0")
    
    if [[ "${concurrent_ops// /}" != "0" ]]; then
        log_warn "Found $concurrent_ops active CONCURRENTLY operations"
        log_warn "Waiting for them to complete before proceeding..."
        
        # Wait up to 5 minutes for concurrent operations to finish
        local wait_count=0
        while [[ $wait_count -lt 60 ]] && [[ "${concurrent_ops// /}" != "0" ]]; do
            sleep 5
            concurrent_ops=$(psql "$DATABASE_URL" -t -c "
                SELECT COUNT(*) 
                FROM pg_stat_activity 
                WHERE query ILIKE '%CREATE INDEX CONCURRENTLY%' 
                AND state = 'active' 
                AND pid != pg_backend_pid();" 2>/dev/null || echo "0")
            ((wait_count++))
        done
        
        if [[ "${concurrent_ops// /}" != "0" ]]; then
            log_error "Concurrent operations are still running after 5 minutes"
            log_error "Please wait for them to complete or investigate manually"
            return 1
        fi
    fi
    
    log_success "No concurrent operations blocking"
    return 0
}

# Verify critical indexes were created
verify_indexes() {
    log_info "Verifying critical indexes were created..."
    
    local critical_indexes=(
        "idx_leaderboard_totals_user_unique"
        "idx_leaderboard_30d_user_unique" 
        "idx_activity_metrics_code_unique"
        "idx_time_series_metrics_date_activity_unique"
    )
    
    local missing_count=0
    for index_name in "${critical_indexes[@]}"; do
        local exists
        exists=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*) 
            FROM pg_indexes 
            WHERE indexname = '$index_name';" 2>/dev/null || echo "0")
        
        if [[ "${exists// /}" == "0" ]]; then
            log_error "Critical index missing: $index_name"
            ((missing_count++))
        else
            log_success "Verified: $index_name"
        fi
    done
    
    if [[ $missing_count -gt 0 ]]; then
        log_error "Found $missing_count missing critical indexes"
        return 1
    fi
    
    log_success "All critical indexes verified successfully"
    return 0
}

# Print usage information
print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  -h, --help          Show this help message
  -n, --dry-run       Show what would be executed without running
  -v, --verify-only   Only verify existing indexes, don't create new ones
  -f, --force         Skip safety checks and run immediately

Environment Variables:
  DATABASE_URL        PostgreSQL connection string (required)

Examples:
  $0                  # Run post-migration operations
  $0 --dry-run        # Preview operations
  $0 --verify-only    # Check existing indexes

This script runs CONCURRENTLY index operations that cannot be executed
within Prisma's migration transactions.
EOF
}

# Main execution
main() {
    local dry_run=false
    local verify_only=false
    local force=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_usage
                exit 0
                ;;
            -n|--dry-run)
                dry_run=true
                shift
                ;;
            -v|--verify-only)
                verify_only=true
                shift
                ;;
            -f|--force)
                force=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
    
    # Pre-flight checks
    check_database_url
    check_sql_file
    
    if [[ "$dry_run" == true ]]; then
        log_info "DRY RUN MODE - Operations that would be executed:"
        echo
        grep -E "^CREATE.*INDEX.*CONCURRENTLY" "$POST_MIGRATE_SQL" | head -10
        echo "... (and more)"
        log_info "Use --help for more information"
        exit 0
    fi
    
    if [[ "$verify_only" == true ]]; then
        test_connection
        verify_indexes
        exit $?
    fi
    
    # Main execution
    log_info "Starting post-migration process"
    log_info "Database: ${DATABASE_URL%\?*}" # Hide query params for logging
    
    test_connection
    
    if [[ "$force" != true ]]; then
        check_concurrent_operations
    fi
    
    run_post_migrate
    verify_indexes
    
    log_success "Post-migration process completed successfully!"
    log_info "Your database now has optimized indexes for high-performance operations"
}

# Run main function with all arguments
main "$@"