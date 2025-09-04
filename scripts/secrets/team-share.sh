#!/bin/bash

# =============================================================================
# Elevate Team Secret Sharing Script
# =============================================================================
# Securely shares encrypted vaults with team members using multiple distribution
# methods while maintaining security best practices.
#
# Usage:
#   ./scripts/secrets/team-share.sh <command> [options]
#
# Commands:
#   package    - Create secure package for team distribution
#   deploy     - Deploy vault to secure storage (CI/CD)
#   verify     - Verify vault integrity and accessibility
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
log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}" >&2; }
bold() { echo -e "${BOLD}$1${NC}"; }

# Create secure team package
create_team_package() {
    local environment="${1:-all}"
    local output_dir="${2:-./team-secrets}"
    
    bold "📦 Creating team secrets package..."
    
    # Create output directory
    mkdir -p "$output_dir"
    chmod 700 "$output_dir"
    
    # Copy vault files
    local secrets_dir="$PROJECT_ROOT/.secrets"
    if [ ! -d "$secrets_dir" ]; then
        error "No secrets directory found"
        exit 1
    fi
    
    if [ "$environment" = "all" ]; then
        cp -r "$secrets_dir" "$output_dir/"
        success "Copied all vault files"
    else
        local vault_file="$secrets_dir/${environment}.vault"
        if [ ! -f "$vault_file" ]; then
            error "Vault not found for environment: $environment"
            exit 1
        fi
        
        mkdir -p "$output_dir/.secrets"
        cp "$vault_file" "$output_dir/.secrets/"
        success "Copied $environment vault"
    fi
    
    # Copy essential scripts
    mkdir -p "$output_dir/scripts/secrets"
    cp "$VAULT_MANAGER" "$output_dir/scripts/secrets/"
    cp "$SCRIPT_DIR/setup-dev-secrets.sh" "$output_dir/scripts/secrets/"
    chmod +x "$output_dir/scripts/secrets/"*.sh
    success "Copied management scripts"
    
    # Create README for team members
    cat > "$output_dir/README.md" << 'EOF'
# Elevate Team Secrets Package

This package contains encrypted vault files and setup scripts for the MS Elevate LEAPS Tracker project.

## Quick Setup

1. **Place this package** in your project root:
   ```bash
   # Extract/copy the contents to your elevate project directory
   cp -r team-secrets/* /path/to/your/elevate/project/
   ```

2. **Run the setup script**:
   ```bash
   # For development environment
   ./scripts/secrets/setup-dev-secrets.sh development onboard
   
   # You'll be prompted for the master password
   # Get this from your team lead securely
   ```

3. **Verify your setup**:
   ```bash
   # Check environment variables
   pnpm env:validate
   
   # Start development servers
   pnpm dev
   ```

## Security Guidelines

### 🔐 Master Password
- **Get from team lead**: Obtain the master password through secure channels
- **Keep secure**: Never share or commit the password
- **Use environment variable**: Set `VAULT_MASTER_PASSWORD` for automation

### 📁 File Management
- **Don't commit**: Never commit `.env.*.local` files
- **Secure permissions**: Ensure vault files have 600 permissions
- **Regular rotation**: Participate in periodic password rotations

### 🚨 Emergency Procedures
If you suspect password compromise:
1. Immediately notify the team lead
2. Stop using the current password
3. Wait for new vault with rotated password
4. Follow team incident response procedures

## Available Commands

```bash
# Extract secrets for development
node scripts/secrets/vault-manager.js extract development

# List available vaults
node scripts/secrets/vault-manager.js list

# Validate environment
pnpm env:validate

# Setup with guided onboarding
./scripts/secrets/setup-dev-secrets.sh development onboard
```

## Troubleshooting

### Password Issues
- **Wrong password**: Verify with team lead
- **Missing password**: Set VAULT_MASTER_PASSWORD environment variable

### Vault Issues
- **Vault not found**: Ensure vault files are in `.secrets/` directory
- **Corrupted vault**: Re-download from team or backup

### Environment Issues
- **Validation fails**: Check for placeholder values in extracted files
- **Services not connecting**: Verify all required secrets are present

## Support

For help, contact your team lead or check the main project documentation:
- `SECRETS_MANAGEMENT.md` - Complete secrets management guide
- `plan2.md` - Project requirements and setup
- Team chat or issue tracker

---
Generated: $(date)
Package contents secured with AES-256-GCM encryption
EOF
    
    success "Created team README"
    
    # Create checksum file for verification
    find "$output_dir" -type f -name "*.vault" -exec sha256sum {} \; > "$output_dir/checksums.txt"
    success "Generated checksums for verification"
    
    # Create package info
    cat > "$output_dir/package-info.json" << EOF
{
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "creator": "${USER:-unknown}",
  "environment": "$environment",
  "vaults": $(find "$output_dir/.secrets" -name "*.vault" -exec basename {} .vault \; | jq -R . | jq -s .),
  "version": "1.0.0",
  "project": "elevate-leaps-tracker"
}
EOF
    
    echo
    bold "📦 Team package created: $output_dir"
    echo "Contents:"
    find "$output_dir" -type f | sed 's/^/  /'
    echo
    bold "Distribution methods:"
    echo "  1. Secure file sharing (recommended for small teams)"
    echo "  2. Encrypted archive with separate password sharing"
    echo "  3. Private git repository (for CI/CD integration)"
    echo "  4. Secure cloud storage with access controls"
    echo
    warn "⚠️  Remember to share master passwords through secure channels!"
}

# Deploy vault to CI/CD environment
deploy_to_cicd() {
    local environment="$1"
    local platform="${2:-vercel}"
    
    bold "🚀 Deploying secrets to $platform for $environment..."
    
    # Validate inputs
    if [ -z "$environment" ]; then
        error "Environment required for CI/CD deployment"
        exit 1
    fi
    
    local vault_file="$PROJECT_ROOT/.secrets/${environment}.vault"
    if [ ! -f "$vault_file" ]; then
        error "Vault not found: $vault_file"
        exit 1
    fi
    
    case "$platform" in
        "vercel")
            deploy_to_vercel "$environment" "$vault_file"
            ;;
        "github")
            deploy_to_github "$environment" "$vault_file"
            ;;
        "railway")
            deploy_to_railway "$environment" "$vault_file"
            ;;
        *)
            error "Unsupported platform: $platform"
            echo "Supported platforms: vercel, github, railway"
            exit 1
            ;;
    esac
}

# Deploy to Vercel
deploy_to_vercel() {
    local environment="$1"
    local vault_file="$2"
    
    log "Deploying to Vercel for $environment environment..."
    
    if ! command -v vercel &> /dev/null; then
        error "Vercel CLI not installed. Install with: npm i -g vercel"
        exit 1
    fi
    
    # Set vault file as environment variable (base64 encoded)
    local vault_content
    vault_content=$(base64 -i "$vault_file")
    
    local env_target
    case "$environment" in
        "production") env_target="production" ;;
        "staging") env_target="preview" ;;
        "development") env_target="development" ;;
        *) env_target="development" ;;
    esac
    
    # Set the vault content as an environment variable
    echo "$vault_content" | vercel env add "SECRETS_VAULT_${environment^^}" "$env_target" --sensitive
    
    success "Vault deployed to Vercel as SECRETS_VAULT_${environment^^}"
    
    # Also set the master password (if provided)
    if [ -n "${VAULT_MASTER_PASSWORD:-}" ]; then
        echo "$VAULT_MASTER_PASSWORD" | vercel env add "VAULT_MASTER_PASSWORD_${environment^^}" "$env_target" --sensitive
        success "Master password deployed to Vercel"
    else
        warn "VAULT_MASTER_PASSWORD not set - you'll need to set it manually in Vercel"
    fi
}

# Deploy to GitHub Actions
deploy_to_github() {
    local environment="$1"
    local vault_file="$2"
    
    log "Instructions for GitHub Actions deployment..."
    
    local vault_content
    vault_content=$(base64 -i "$vault_file")
    
    echo
    bold "GitHub Secrets to set:"
    echo "  SECRETS_VAULT_${environment^^}:"
    echo "    Value: (copy the base64 content below)"
    echo "    Environment: $environment"
    echo
    echo "Base64 vault content:"
    echo "$vault_content"
    echo
    
    if [ -n "${VAULT_MASTER_PASSWORD:-}" ]; then
        echo "  VAULT_MASTER_PASSWORD_${environment^^}:"
        echo "    Value: $VAULT_MASTER_PASSWORD"
        echo "    Environment: $environment"
        echo
    fi
    
    bold "GitHub Actions workflow example:"
    cat << EOF

    - name: Setup secrets for $environment
      run: |
        echo "\${{ secrets.SECRETS_VAULT_${environment^^} }}" | base64 -d > .secrets/${environment}.vault
        VAULT_MASTER_PASSWORD="\${{ secrets.VAULT_MASTER_PASSWORD_${environment^^} }}" \\
          node scripts/secrets/vault-manager.js extract $environment
      
    - name: Validate environment
      run: pnpm env:validate --environment $environment

EOF
}

# Deploy to Railway
deploy_to_railway() {
    local environment="$1"
    local vault_file="$2"
    
    log "Instructions for Railway deployment..."
    
    local vault_content
    vault_content=$(base64 -i "$vault_file")
    
    echo
    bold "Railway Environment Variables to set:"
    echo "  SECRETS_VAULT_${environment^^} = (base64 content below)"
    if [ -n "${VAULT_MASTER_PASSWORD:-}" ]; then
        echo "  VAULT_MASTER_PASSWORD_${environment^^} = $VAULT_MASTER_PASSWORD"
    fi
    echo
    echo "Base64 vault content:"
    echo "$vault_content"
    echo
    
    bold "Railway build command example:"
    echo "echo \"\$SECRETS_VAULT_${environment^^}\" | base64 -d > .secrets/${environment}.vault && VAULT_MASTER_PASSWORD=\"\$VAULT_MASTER_PASSWORD_${environment^^}\" node scripts/secrets/vault-manager.js extract $environment && pnpm build"
}

# Verify vault integrity and accessibility
verify_vaults() {
    local environment="${1:-all}"
    
    bold "🔍 Verifying vault integrity..."
    
    local secrets_dir="$PROJECT_ROOT/.secrets"
    if [ ! -d "$secrets_dir" ]; then
        error "No secrets directory found"
        exit 1
    fi
    
    local verified=0
    local failed=0
    
    if [ "$environment" = "all" ]; then
        for vault_file in "$secrets_dir"/*.vault; do
            if [ -f "$vault_file" ]; then
                local env_name
                env_name=$(basename "$vault_file" .vault)
                if verify_single_vault "$env_name"; then
                    ((verified++))
                else
                    ((failed++))
                fi
            fi
        done
    else
        if verify_single_vault "$environment"; then
            ((verified++))
        else
            ((failed++))
        fi
    fi
    
    echo
    if [ $failed -eq 0 ]; then
        success "All vaults verified successfully ($verified total)"
    else
        error "$failed vaults failed verification, $verified succeeded"
        exit 1
    fi
}

# Verify single vault
verify_single_vault() {
    local environment="$1"
    local vault_file="$PROJECT_ROOT/.secrets/${environment}.vault"
    
    log "Verifying $environment vault..."
    
    if [ ! -f "$vault_file" ]; then
        error "Vault file not found: $vault_file"
        return 1
    fi
    
    # Check file permissions
    local perms
    perms=$(stat -c "%a" "$vault_file" 2>/dev/null || stat -f "%Lp" "$vault_file" 2>/dev/null || echo "unknown")
    if [ "$perms" != "600" ] && [ "$perms" != "unknown" ]; then
        warn "Vault file permissions are $perms (should be 600)"
    fi
    
    # Check JSON structure
    if ! python3 -c "import json; json.load(open('$vault_file'))" 2>/dev/null; then
        error "Vault file is not valid JSON"
        return 1
    fi
    
    # Check required fields
    local required_fields=("encrypted" "salt" "iv" "authTag" "algorithm")
    for field in "${required_fields[@]}"; do
        if ! python3 -c "import json; data=json.load(open('$vault_file')); assert '$field' in data" 2>/dev/null; then
            error "Vault missing required field: $field"
            return 1
        fi
    done
    
    success "$environment vault structure is valid"
    
    # Try to decrypt if master password is available
    if [ -n "${VAULT_MASTER_PASSWORD:-}" ]; then
        if VAULT_MASTER_PASSWORD="$VAULT_MASTER_PASSWORD" node "$VAULT_MANAGER" extract "$environment" "" "/tmp/test-extract-$$" 2>/dev/null; then
            rm -f "/tmp/test-extract-$$"
            success "$environment vault decryption test passed"
        else
            error "$environment vault decryption test failed"
            return 1
        fi
    else
        warn "$environment vault decryption not tested (no VAULT_MASTER_PASSWORD)"
    fi
    
    return 0
}

# Main execution
main() {
    local command="${1:-}"
    
    case "$command" in
        "package")
            local environment="${2:-all}"
            local output_dir="${3:-./team-secrets}"
            create_team_package "$environment" "$output_dir"
            ;;
        "deploy")
            local environment="${2:-}"
            local platform="${3:-vercel}"
            deploy_to_cicd "$environment" "$platform"
            ;;
        "verify")
            local environment="${2:-all}"
            verify_vaults "$environment"
            ;;
        "help"|"")
            cat << 'EOF'

Elevate Team Secret Sharing

Usage:
  team-share.sh <command> [options]

Commands:
  package <env> [output-dir]    Create team secrets package
                                env: all|development|staging|production
                                output-dir: default ./team-secrets

  deploy <env> [platform]       Deploy vault to CI/CD platform
                                env: development|staging|production
                                platform: vercel|github|railway

  verify [env]                  Verify vault integrity
                                env: all|development|staging|production

  help                          Show this help

Examples:
  # Create package for all environments
  ./team-share.sh package all

  # Create package for just development
  ./team-share.sh package development ./dev-secrets

  # Deploy production vault to Vercel
  VAULT_MASTER_PASSWORD="..." ./team-share.sh deploy production vercel

  # Verify all vaults
  ./team-share.sh verify

Environment Variables:
  VAULT_MASTER_PASSWORD    Master password for deployment/verification

EOF
            ;;
        *)
            error "Unknown command: $command"
            echo "Run 'team-share.sh help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main with all arguments
main "$@"