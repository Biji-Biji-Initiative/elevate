#!/bin/bash

# =============================================================================
# Elevate Development Secrets Setup Script
# =============================================================================
# Sets up secure local development environment with encrypted secrets management
# while preserving the existing three-layer environment system.
#
# Usage:
#   ./scripts/secrets/setup-dev-secrets.sh [environment]
#
# Requirements:
#   - Vault master password (via VAULT_MASTER_PASSWORD or prompt)
#   - Access to encrypted vault for environment
#   - Proper file permissions
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VAULT_MANAGER="$SCRIPT_DIR/vault-manager.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

bold() {
    echo -e "${BOLD}$1${NC}"
}

# Check if running in project root
check_project_root() {
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        error "Must be run from project root or scripts directory"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    bold "🔍 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check vault manager exists
    if [ ! -f "$VAULT_MANAGER" ]; then
        error "Vault manager not found: $VAULT_MANAGER"
        exit 1
    fi
    
    # Check if we're in a git repository
    if [ ! -d "$PROJECT_ROOT/.git" ]; then
        warn "Not in a git repository - some security features may not work"
    fi
    
    success "Prerequisites check passed"
}

# Get master password securely
get_master_password() {
    local env="$1"
    
    if [ -n "${VAULT_MASTER_PASSWORD:-}" ]; then
        log "Using master password from environment variable"
        echo "$VAULT_MASTER_PASSWORD"
        return
    fi
    
    bold "🔐 Master password required for $env vault"
    echo -n "Enter master password (input hidden): "
    read -s password
    echo
    
    if [ -z "$password" ]; then
        error "Master password cannot be empty"
        exit 1
    fi
    
    echo "$password"
}

# Create secure local environment directory
setup_local_env_dir() {
    local env_dir="$PROJECT_ROOT/.env-local"
    
    log "Setting up local environment directory..."
    
    # Create directory with restrictive permissions
    mkdir -p "$env_dir"
    chmod 700 "$env_dir"
    
    # Add to gitignore if not already present
    local gitignore="$PROJECT_ROOT/.gitignore"
    if [ -f "$gitignore" ] && ! grep -q ".env-local" "$gitignore"; then
        echo "" >> "$gitignore"
        echo "# Local development secrets directory" >> "$gitignore"
        echo ".env-local/" >> "$gitignore"
        success "Added .env-local/ to .gitignore"
    fi
    
    echo "$env_dir"
}

# Extract secrets from vault
extract_secrets() {
    local environment="$1"
    local master_password="$2"
    local local_env_dir="$3"
    
    bold "📤 Extracting secrets for $environment environment..."
    
    # Extract to temporary file first
    local temp_file="$local_env_dir/.env.${environment}.tmp"
    local final_file="$PROJECT_ROOT/.env.${environment}.local"
    
    # Use vault manager to extract secrets
    if VAULT_MASTER_PASSWORD="$master_password" node "$VAULT_MANAGER" extract "$environment" "" "$temp_file"; then
        # Move to final location
        mv "$temp_file" "$final_file"
        chmod 600 "$final_file"
        success "Secrets extracted to: .env.${environment}.local"
    else
        error "Failed to extract secrets from vault"
        rm -f "$temp_file"
        exit 1
    fi
}

# Validate extracted environment
validate_environment() {
    local environment="$1"
    
    log "🔍 Validating extracted environment..."
    
    # Use existing validation script
    if [ -f "$PROJECT_ROOT/scripts/validate-env.js" ]; then
        if node "$PROJECT_ROOT/scripts/validate-env.js" --environment "$environment" --silent; then
            success "Environment validation passed"
        else
            warn "Environment validation found issues - check output above"
            echo
            bold "You may need to:"
            echo "  1. Check that all required secrets are in the vault"
            echo "  2. Update placeholder values in environment files"
            echo "  3. Verify vault was created from correct source files"
            echo
        fi
    else
        warn "Environment validation script not found - skipping validation"
    fi
}

# Setup development environment
setup_development() {
    local environment="${1:-development}"
    
    bold "🚀 Setting up $environment environment secrets..."
    echo
    
    # Check if vault exists
    local vault_file="$PROJECT_ROOT/.secrets/${environment}.vault"
    if [ ! -f "$vault_file" ]; then
        error "Vault not found for environment: $environment"
        echo
        bold "To create a vault, run:"
        echo "  node scripts/secrets/vault-manager.js create $environment"
        echo
        exit 1
    fi
    
    # Get master password
    local master_password
    master_password=$(get_master_password "$environment")
    
    # Setup local environment directory
    local local_env_dir
    local_env_dir=$(setup_local_env_dir)
    
    # Extract secrets from vault
    extract_secrets "$environment" "$master_password" "$local_env_dir"
    
    # Validate the environment
    validate_environment "$environment"
    
    echo
    success "Development environment setup complete!"
    echo
    bold "Next steps:"
    echo "  1. Run 'pnpm dev' to start development servers"
    echo "  2. Check that all services connect properly"
    echo "  3. Update any remaining placeholder values if needed"
    echo
    bold "Security reminders:"
    echo "  • Never commit .env.*.local files"
    echo "  • Keep your master password secure"
    echo "  • Rotate passwords periodically"
    echo
}

# Setup team member onboarding
setup_team_member() {
    local environment="${1:-development}"
    
    bold "👥 Team Member Onboarding for $environment"
    echo
    
    log "This script will help you set up your local development environment"
    log "You'll need the vault master password from your team lead"
    echo
    
    # Check if they have the vault
    local vault_file="$PROJECT_ROOT/.secrets/${environment}.vault"
    if [ ! -f "$vault_file" ]; then
        error "Vault file not found: $vault_file"
        echo
        bold "You need to:"
        echo "  1. Get the vault file from your team"
        echo "  2. Place it in: .secrets/${environment}.vault"
        echo "  3. Ensure it has proper permissions (600)"
        echo
        exit 1
    fi
    
    setup_development "$environment"
    
    echo
    bold "🎉 Welcome to the team! Your development environment is ready."
}

# Cleanup function for secure handling
cleanup() {
    # Clear any temporary files or sensitive data from memory
    unset VAULT_MASTER_PASSWORD
}

# Trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    local environment="${1:-development}"
    local mode="${2:-setup}"
    
    echo
    bold "🔐 Elevate Development Secrets Setup"
    echo "Environment: $environment"
    echo "Mode: $mode"
    echo
    
    check_project_root
    check_prerequisites
    
    case "$mode" in
        "setup"|"")
            setup_development "$environment"
            ;;
        "onboard"|"team")
            setup_team_member "$environment"
            ;;
        "help")
            cat << 'EOF'

Elevate Development Secrets Setup

Usage:
  setup-dev-secrets.sh [environment] [mode]

Arguments:
  environment    Target environment (default: development)
                 Options: development, staging, production
  
  mode          Setup mode (default: setup)
                Options:
                  setup    - Standard setup for existing team members
                  onboard  - Guided setup for new team members
                  team     - Alias for onboard
                  help     - Show this help

Environment Variables:
  VAULT_MASTER_PASSWORD    Master password for vault decryption
                          (will prompt if not set)

Examples:
  # Setup development environment
  ./setup-dev-secrets.sh

  # Setup staging environment
  ./setup-dev-secrets.sh staging

  # Onboard new team member for development
  ./setup-dev-secrets.sh development onboard

Security Features:
  • Encrypted vault storage with AES-256-GCM
  • Secure password prompting (hidden input)
  • Automatic .gitignore updates
  • File permission management
  • Environment validation

For more information, see SECRETS_MANAGEMENT.md

EOF
            ;;
        *)
            error "Unknown mode: $mode"
            echo "Run with 'help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"