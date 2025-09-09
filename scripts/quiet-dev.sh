#!/bin/bash
# Quiet development mode - reduces terminal noise
# Usage: source scripts/quiet-dev.sh

echo "🔇 Setting quiet development mode..."

# Database logging - only errors
export DB_LOG_LEVEL=ERROR
export DB_LOGGING=false
export DB_LOG_QUERY_PARAMS=false
export DB_LOG_PERFORMANCE=false
export DB_MAX_QUERY_LOG_LENGTH=50

# General logging
export LOG_LEVEL=warn

echo "✅ Quiet mode enabled:"
echo "  - Database logging: ERROR only"
echo "  - Query logging: disabled"
echo "  - Performance logging: disabled"
echo ""
echo "To start your dev server with quiet mode:"
echo "  source scripts/quiet-dev.sh && pnpm dev"
