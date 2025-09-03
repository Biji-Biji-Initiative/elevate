#!/bin/bash

# Cache Performance Measurement Script for MS Elevate LEAPS Tracker
# Measures build performance improvements with Turbo caching

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
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

metric() {
    echo -e "${PURPLE}[METRIC]${NC} $1"
}

# Check if we're in the correct directory
if [[ ! -f "turbo.json" ]]; then
    error "This script must be run from the project root directory"
    exit 1
fi

# Function to measure build time
measure_build_time() {
    local test_name="$1"
    local command="$2"
    local runs="${3:-3}"
    
    log "Measuring: $test_name"
    log "Command: $command"
    log "Runs: $runs"
    
    local times=()
    local total_time=0
    
    for ((i=1; i<=runs; i++)); do
        log "Run $i/$runs..."
        
        # Clear any existing build outputs but preserve cache
        find . -name ".next" -type d -not -path "./.turbo/*" -exec rm -rf {} + 2>/dev/null || true
        find . -name "dist" -type d -not -path "./.turbo/*" -exec rm -rf {} + 2>/dev/null || true
        
        # Measure execution time
        start_time=$(date +%s.%3N)
        eval "$command" > /tmp/build_output_$i.log 2>&1
        end_time=$(date +%s.%3N)
        
        local duration=$(echo "$end_time - $start_time" | bc)
        times+=("$duration")
        total_time=$(echo "$total_time + $duration" | bc)
        
        metric "Run $i: ${duration}s"
    done
    
    # Calculate statistics
    local avg_time=$(echo "scale=3; $total_time / $runs" | bc)
    local min_time=$(printf '%s\n' "${times[@]}" | sort -n | head -1)
    local max_time=$(printf '%s\n' "${times[@]}" | sort -n | tail -1)
    
    # Store results globally
    eval "${test_name}_avg=$avg_time"
    eval "${test_name}_min=$min_time"
    eval "${test_name}_max=$max_time"
    eval "${test_name}_runs=$runs"
    
    success "$test_name complete - Avg: ${avg_time}s, Min: ${min_time}s, Max: ${max_time}s"
    echo ""
}

# Function to get cache statistics
get_cache_stats() {
    local cache_entries=0
    local cache_size="0"
    local cache_hits=0
    local cache_misses=0
    
    if [[ -d ".turbo/cache" ]]; then
        cache_entries=$(find .turbo/cache -type f 2>/dev/null | wc -l | tr -d ' ')
        cache_size=$(du -s .turbo/cache 2>/dev/null | cut -f1 || echo "0")
    fi
    
    # Try to extract cache hit/miss info from recent turbo output
    if [[ -f "/tmp/build_output_1.log" ]]; then
        cache_hits=$(grep -o "cache hit" /tmp/build_output_1.log 2>/dev/null | wc -l | tr -d ' ')
        cache_misses=$(grep -o "cache miss" /tmp/build_output_1.log 2>/dev/null | wc -l | tr -d ' ')
    fi
    
    echo "$cache_entries,$cache_size,$cache_hits,$cache_misses"
}

# Function to run performance test suite
run_performance_tests() {
    header "🚀 Turbo Cache Performance Measurement"
    header "════════════════════════════════════════"
    echo ""
    
    # Get initial cache stats
    local initial_stats=$(get_cache_stats)
    local initial_entries=$(echo "$initial_stats" | cut -d',' -f1)
    local initial_size=$(echo "$initial_stats" | cut -d',' -f2)
    
    log "Initial cache state:"
    log "  Entries: $initial_entries"
    log "  Size: ${initial_size}KB"
    echo ""
    
    # Test 1: Cold build (no cache)
    header "📊 Test 1: Cold Build (Force Rebuild)"
    log "This test measures build time without any cache benefits"
    measure_build_time "cold_build" "pnpm turbo run build --force" 3
    
    # Test 2: Warm build (with cache)
    header "📊 Test 2: Warm Build (With Cache)"
    log "This test measures build time with full cache utilization"
    measure_build_time "warm_build" "pnpm turbo run build" 3
    
    # Test 3: Incremental build (touch one file)
    header "📊 Test 3: Incremental Build"
    log "This test measures build time after a small change"
    
    # Make a small change to trigger partial rebuild
    echo "// Performance test marker: $(date)" >> packages/types/src/index.ts
    measure_build_time "incremental_build" "pnpm turbo run build" 3
    
    # Cleanup the test change
    git checkout packages/types/src/index.ts 2>/dev/null || true
    
    # Test 4: Type checking only
    header "📊 Test 4: Type Check Only"
    log "This test measures type checking performance with cache"
    measure_build_time "typecheck_only" "pnpm turbo run typecheck" 3
    
    # Test 5: Lint only  
    header "📊 Test 5: Lint Only"
    log "This test measures linting performance with cache"
    measure_build_time "lint_only" "pnpm turbo run lint" 3
}

# Function to calculate performance improvements
calculate_improvements() {
    header "📈 Performance Analysis"
    echo ""
    
    # Calculate cache effectiveness
    if [[ -n "$cold_build_avg" ]] && [[ -n "$warm_build_avg" ]]; then
        local improvement=$(echo "scale=1; (($cold_build_avg - $warm_build_avg) / $cold_build_avg) * 100" | bc)
        local time_saved=$(echo "scale=3; $cold_build_avg - $warm_build_avg" | bc)
        
        metric "Cold vs Warm Build:"
        metric "  Cold build average: ${cold_build_avg}s"
        metric "  Warm build average: ${warm_build_avg}s"
        metric "  Time saved: ${time_saved}s"
        metric "  Performance improvement: ${improvement}%"
        echo ""
    fi
    
    # Calculate incremental build efficiency
    if [[ -n "$warm_build_avg" ]] && [[ -n "$incremental_build_avg" ]]; then
        local incremental_ratio=$(echo "scale=2; $incremental_build_avg / $warm_build_avg" | bc)
        
        metric "Incremental Build Efficiency:"
        metric "  Full build average: ${warm_build_avg}s"
        metric "  Incremental build average: ${incremental_build_avg}s"
        metric "  Incremental ratio: ${incremental_ratio}x"
        echo ""
    fi
    
    # Get final cache stats
    local final_stats=$(get_cache_stats)
    local final_entries=$(echo "$final_stats" | cut -d',' -f1)
    local final_size=$(echo "$final_stats" | cut -d',' -f2)
    local cache_hits=$(echo "$final_stats" | cut -d',' -f3)
    local cache_misses=$(echo "$final_stats" | cut -d',' -f4)
    
    metric "Cache Statistics:"
    metric "  Final entries: $final_entries"
    metric "  Final size: ${final_size}KB"
    metric "  Cache hits: $cache_hits"
    metric "  Cache misses: $cache_misses"
    
    if [[ $cache_hits -gt 0 ]] || [[ $cache_misses -gt 0 ]]; then
        local hit_rate=$(echo "scale=1; ($cache_hits / ($cache_hits + $cache_misses)) * 100" | bc)
        metric "  Hit rate: ${hit_rate}%"
    fi
}

# Function to generate performance report
generate_report() {
    local report_file="cache-performance-report-$(date +%Y%m%d-%H%M%S).json"
    
    header "📄 Generating Performance Report"
    
    # Create JSON report
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "test_environment": {
    "node_version": "$(node --version 2>/dev/null || echo 'unknown')",
    "turbo_version": "$(npx turbo --version 2>/dev/null || echo 'unknown')",
    "platform": "$(uname -s)",
    "cpu_count": $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)
  },
  "test_results": {
    "cold_build": {
      "average_time": ${cold_build_avg:-0},
      "min_time": ${cold_build_min:-0},
      "max_time": ${cold_build_max:-0},
      "runs": ${cold_build_runs:-0}
    },
    "warm_build": {
      "average_time": ${warm_build_avg:-0},
      "min_time": ${warm_build_min:-0},
      "max_time": ${warm_build_max:-0},
      "runs": ${warm_build_runs:-0}
    },
    "incremental_build": {
      "average_time": ${incremental_build_avg:-0},
      "min_time": ${incremental_build_min:-0},
      "max_time": ${incremental_build_max:-0},
      "runs": ${incremental_build_runs:-0}
    },
    "typecheck_only": {
      "average_time": ${typecheck_only_avg:-0},
      "min_time": ${typecheck_only_min:-0},
      "max_time": ${typecheck_only_max:-0},
      "runs": ${typecheck_only_runs:-0}
    },
    "lint_only": {
      "average_time": ${lint_only_avg:-0},
      "min_time": ${lint_only_min:-0},
      "max_time": ${lint_only_max:-0},
      "runs": ${lint_only_runs:-0}
    }
  },
  "cache_analysis": {
    "final_entries": $(get_cache_stats | cut -d',' -f1),
    "final_size_kb": $(get_cache_stats | cut -d',' -f2),
    "cache_hits": $(get_cache_stats | cut -d',' -f3),
    "cache_misses": $(get_cache_stats | cut -d',' -f4)
  }
}
EOF
    
    success "Performance report saved to: $report_file"
    
    # Generate summary
    header "📋 Performance Summary"
    echo ""
    if [[ -n "$cold_build_avg" ]] && [[ -n "$warm_build_avg" ]]; then
        local improvement=$(echo "scale=1; (($cold_build_avg - $warm_build_avg) / $cold_build_avg) * 100" | bc)
        echo "🎯 Key Findings:"
        echo "  • Cache-enabled builds are ${improvement}% faster"
        echo "  • Time saved per build: $(echo "scale=1; $cold_build_avg - $warm_build_avg" | bc)s"
        echo "  • Cache entries generated: $(get_cache_stats | cut -d',' -f1)"
        echo ""
        
        if (( $(echo "$improvement > 50" | bc -l) )); then
            success "Excellent cache performance (>50% improvement)!"
        elif (( $(echo "$improvement > 30" | bc -l) )); then
            success "Good cache performance (30-50% improvement)"
        elif (( $(echo "$improvement > 15" | bc -l) )); then
            log "Moderate cache performance (15-30% improvement)"
        else
            warning "Limited cache performance (<15% improvement)"
        fi
    fi
    
    echo ""
    echo "💡 Recommendations:"
    echo "  • Enable remote caching for team collaboration"
    echo "  • Set up CI/CD cache sharing for faster deployments"
    echo "  • Regular cache cleanup to maintain optimal performance"
    echo "  • Monitor cache hit rates during development"
    echo ""
    echo "📊 Full report: $report_file"
}

# Main execution
main() {
    # Check for required tools
    if ! command -v bc &> /dev/null; then
        error "bc calculator is required but not installed"
        echo "Install with: brew install bc (macOS) or apt-get install bc (Linux)"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        error "npx is required but not found"
        exit 1
    fi
    
    # Run performance tests
    run_performance_tests
    
    # Analyze results
    calculate_improvements
    
    # Generate report
    generate_report
    
    # Cleanup
    rm -f /tmp/build_output_*.log 2>/dev/null || true
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "This script measures Turbo cache performance by running various build scenarios"
        echo "and comparing execution times with and without cache benefits."
        echo ""
        echo "Options:"
        echo "  --help, -h      Show this help message"
        echo "  --quick         Run quick performance test (1 run per test)"
        echo "  --detailed      Run detailed performance test (5 runs per test)"
        echo ""
        echo "Test scenarios:"
        echo "  • Cold build (--force, no cache benefit)"
        echo "  • Warm build (with full cache utilization)"
        echo "  • Incremental build (after small code change)"
        echo "  • Type check only"
        echo "  • Lint only"
        echo ""
        echo "The script generates a detailed JSON report and performance summary."
        echo ""
        echo "Examples:"
        echo "  $0                    # Standard test (3 runs per scenario)"
        echo "  $0 --quick           # Quick test (1 run per scenario)"
        echo "  $0 --detailed        # Detailed test (5 runs per scenario)"
        exit 0
        ;;
    --quick)
        # Override the default run count in measure_build_time calls
        sed -i.bak 's/measure_build_time "\([^"]*\)" "\([^"]*\)" [0-9]/measure_build_time "\1" "\2" 1/g' "$0"
        main
        ;;
    --detailed)
        # Override the default run count in measure_build_time calls  
        sed -i.bak 's/measure_build_time "\([^"]*\)" "\([^"]*\)" [0-9]/measure_build_time "\1" "\2" 5/g' "$0"
        main
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac