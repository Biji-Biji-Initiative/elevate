#!/bin/bash

# =============================================================================
# Elevate Secrets Rotation Script
# =============================================================================
# Implements comprehensive secret rotation procedures for the MS Elevate LEAPS
# Tracker, including password rotation, emergency procedures, and team coordination.
#
# Usage:
#   ./scripts/secrets/rotate-secrets.sh <command> [options]
#
# Commands:
#   rotate     - Rotate vault encryption passwords
#   emergency  - Emergency secret rotation (compromised passwords)
#   schedule   - Set up scheduled rotation reminders
#   audit      - Audit rotation history and compliance
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VAULT_MANAGER="$SCRIPT_DIR/vault-manager.js"
ROTATION_LOG="$PROJECT_ROOT/.secrets/rotation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Logging functions
log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}" >&2; }
bold() { echo -e "${BOLD}$1${NC}"; }

# Log rotation events
log_rotation() {
    local event="$1"
    local environment="$2"
    local details="${3:-}"
    
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    mkdir -p "$(dirname "$ROTATION_LOG")"
    echo "$timestamp|$event|$environment|${USER:-unknown}|$details" >> "$ROTATION_LOG"
}

# Get secure password input
get_password() {
    local prompt="$1"
    local password
    
    echo -n "$prompt: "
    read -s password
    echo
    
    if [ -z "$password" ]; then
        error "Password cannot be empty"
        exit 1
    fi
    
    echo "$password"
}

# Generate strong password
generate_password() {
    local length="${1:-32}"
    
    # Use Node.js crypto for strong password generation
    node -e "
        const crypto = require('crypto');
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < $length; i++) {
            password += chars.charAt(crypto.randomInt(chars.length));
        }
        console.log(password);
    "
}

# Verify password strength
verify_password_strength() {
    local password="$1"
    local min_length=16
    local issues=()
    
    # Check length
    if [ ${#password} -lt $min_length ]; then
        issues+=("Password must be at least $min_length characters")
    fi
    
    # Check character variety using Node.js
    local variety_check
    variety_check=$(node -e "
        const password = '$password';
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]/.test(password);
        const variety = [hasLower, hasUpper, hasNumber, hasSpecial].filter(x => x).length;
        console.log(variety);
    ")
    
    if [ "$variety_check" -lt 3 ]; then
        issues+=("Password must include at least 3 of: lowercase, uppercase, numbers, symbols")
    fi
    
    # Check for common patterns
    if echo "$password" | grep -qE "(123|abc|password|admin|test)"; then
        issues+=("Password contains common patterns")
    fi
    
    if [ ${#issues[@]} -gt 0 ]; then
        error "Password strength issues:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        return 1
    fi
    
    return 0
}

# Standard password rotation
rotate_password() {
    local environment="$1"
    local force="${2:-false}"
    
    bold "🔄 Rotating password for $environment environment"
    
    # Check if vault exists
    local vault_file="$PROJECT_ROOT/.secrets/${environment}.vault"
    if [ ! -f "$vault_file" ]; then
        error "Vault not found: $vault_file"
        exit 1
    fi
    
    # Get current password
    local old_password
    if [ -n "${VAULT_OLD_PASSWORD:-}" ]; then
        old_password="$VAULT_OLD_PASSWORD"
        log "Using old password from environment variable"
    else
        old_password=$(get_password "Current master password")
    fi
    
    # Test current password
    log "Verifying current password..."
    if ! VAULT_MASTER_PASSWORD="$old_password" node "$VAULT_MANAGER" extract "$environment" "" "/tmp/rotation-test-$$" 2>/dev/null; then
        rm -f "/tmp/rotation-test-$$"
        error "Current password verification failed"
        exit 1
    fi
    rm -f "/tmp/rotation-test-$$"
    success "Current password verified"
    
    # Get new password
    local new_password
    local use_generated="${ROTATION_GENERATE_PASSWORD:-false}"
    
    if [ "$use_generated" = "true" ]; then
        new_password=$(generate_password 32)
        success "Generated new password: $new_password"
        warn "⚠️  Save this password securely - it cannot be recovered!"
    else
        while true; do
            new_password=$(get_password "New master password")
            local confirm_password
            confirm_password=$(get_password "Confirm new password")
            
            if [ "$new_password" = "$confirm_password" ]; then
                break
            else
                error "Passwords do not match. Please try again."
            fi
        done
        
        if ! verify_password_strength "$new_password"; then
            if [ "$force" != "true" ]; then
                error "Password does not meet strength requirements. Use --force to override."
                exit 1
            else
                warn "Proceeding with weak password due to --force flag"
            fi
        fi
    fi
    
    # Perform rotation
    log "Rotating vault encryption..."
    if VAULT_OLD_PASSWORD="$old_password" VAULT_NEW_PASSWORD="$new_password" \
       node "$VAULT_MANAGER" rotate "$environment" "$old_password" "$new_password"; then
        
        success "Password rotation completed successfully"
        log_rotation "PASSWORD_ROTATED" "$environment" "Standard rotation"
        
        # Update CI/CD if configured
        if [ -n "${UPDATE_CICD:-}" ]; then
            update_cicd_secrets "$environment" "$new_password"
        fi
        
    else
        error "Password rotation failed"
        log_rotation "ROTATION_FAILED" "$environment" "Standard rotation failed"
        exit 1
    fi
    
    # Verification
    log "Verifying new password..."
    if VAULT_MASTER_PASSWORD="$new_password" node "$VAULT_MANAGER" extract "$environment" "" "/tmp/rotation-verify-$$" 2>/dev/null; then
        rm -f "/tmp/rotation-verify-$$"
        success "New password verification successful"
        
        echo
        bold "🎉 Rotation Complete!"
        echo "Environment: $environment"
        echo "Rotated: $(date)"
        echo
        bold "Next steps:"
        echo "1. Share new password with team members securely"
        echo "2. Update CI/CD environment variables if needed"
        echo "3. Verify team members can access with new password"
        echo "4. Update team documentation"
        echo
        
        return 0
    else
        rm -f "/tmp/rotation-verify-$$"
        error "New password verification failed - rotation may be incomplete"
        log_rotation "ROTATION_INCOMPLETE" "$environment" "Verification failed"
        exit 1
    fi
}

# Emergency rotation (compromised password)
emergency_rotation() {
    local environment="$1"
    
    bold "🚨 EMERGENCY ROTATION for $environment environment"
    warn "This procedure should only be used when passwords are compromised"
    echo
    
    # Confirm emergency
    local confirm
    read -p "Confirm emergency rotation (type 'EMERGENCY' to proceed): " confirm
    if [ "$confirm" != "EMERGENCY" ]; then
        error "Emergency rotation cancelled"
        exit 1
    fi
    
    # Log emergency start
    log_rotation "EMERGENCY_STARTED" "$environment" "User initiated emergency rotation"
    
    # Generate new password automatically for security
    local new_password
    new_password=$(generate_password 32)
    success "Generated emergency password: $new_password"
    
    # Try to rotate with emergency procedures
    local vault_file="$PROJECT_ROOT/.secrets/${environment}.vault"
    if [ ! -f "$vault_file" ]; then
        error "Vault not found: $vault_file"
        exit 1
    fi
    
    # Create emergency backup
    local backup_file="${vault_file}.emergency-backup.$(date +%s)"
    cp "$vault_file" "$backup_file"
    chmod 600 "$backup_file"
    success "Created emergency backup: $(basename "$backup_file")"
    
    # Attempt rotation with multiple password attempts
    local old_password
    local attempts=0
    local max_attempts=3
    
    while [ $attempts -lt $max_attempts ]; do
        ((attempts++))
        echo
        old_password=$(get_password "Current password (attempt $attempts/$max_attempts)")
        
        if VAULT_OLD_PASSWORD="$old_password" VAULT_NEW_PASSWORD="$new_password" \
           node "$VAULT_MANAGER" rotate "$environment" "$old_password" "$new_password" 2>/dev/null; then
            
            success "Emergency rotation completed!"
            log_rotation "EMERGENCY_COMPLETED" "$environment" "Successful after $attempts attempts"
            break
        else
            warn "Rotation attempt $attempts failed"
            
            if [ $attempts -eq $max_attempts ]; then
                error "All rotation attempts failed"
                log_rotation "EMERGENCY_FAILED" "$environment" "All attempts failed"
                
                # Restore backup
                cp "$backup_file" "$vault_file"
                warn "Restored original vault file"
                
                echo
                bold "Emergency recovery options:"
                echo "1. Contact system administrator for manual intervention"
                echo "2. Restore from secure backup if available"
                echo "3. Recreate vault from source environment files"
                echo
                exit 1
            fi
        fi
    done
    
    # Emergency notification template
    echo
    bold "🚨 EMERGENCY ROTATION COMPLETE"
    echo "Environment: $environment"
    echo "New password: $new_password"
    echo "Backup created: $(basename "$backup_file")"
    echo
    bold "URGENT: Notify all team members immediately!"
    echo "Send the following message through secure channels:"
    echo
    echo "---"
    echo "EMERGENCY: $environment vault password rotated"
    echo "Reason: Security incident"
    echo "Action required: Update local password immediately"
    echo "New setup: ./scripts/secrets/setup-dev-secrets.sh $environment"
    echo "Contact: [Your contact information]"
    echo "---"
    echo
}

# Update CI/CD secrets
update_cicd_secrets() {
    local environment="$1"
    local new_password="$2"
    
    log "Updating CI/CD secrets..."
    
    case "${CICD_PLATFORM:-vercel}" in
        "vercel")
            if command -v vercel &> /dev/null; then
                echo "$new_password" | vercel env add "VAULT_MASTER_PASSWORD_${environment^^}" \
                    "${environment}" --sensitive --force
                success "Updated Vercel environment variable"
            else
                warn "Vercel CLI not found - manual update required"
            fi
            ;;
        "github")
            warn "GitHub Actions secrets require manual update through web interface"
            echo "Update: VAULT_MASTER_PASSWORD_${environment^^} = $new_password"
            ;;
        *)
            warn "Unknown CI/CD platform - manual update required"
            ;;
    esac
}

# Audit rotation history
audit_rotations() {
    local environment="${1:-all}"
    
    bold "📊 Rotation Audit Report"
    echo
    
    if [ ! -f "$ROTATION_LOG" ]; then
        warn "No rotation log found"
        return
    fi
    
    local filter=""
    if [ "$environment" != "all" ]; then
        filter="$environment"
    fi
    
    # Parse log and generate report
    log "Recent rotation events:"
    echo
    
    {
        echo "Date|Event|Environment|User|Details"
        echo "---|---|---|---|---"
        
        if [ -n "$filter" ]; then
            grep "|$filter|" "$ROTATION_LOG" | tail -20
        else
            tail -20 "$ROTATION_LOG"
        fi
    } | while IFS='|' read -r timestamp event env user details; do
        if [ "$timestamp" = "Date" ]; then
            printf "%-20s %-18s %-12s %-10s %s\n" "$timestamp" "$event" "$env" "$user" "$details"
        else
            printf "%-20s %-18s %-12s %-10s %s\n" \
                "$(date -d "$timestamp" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$timestamp")" \
                "$event" "$env" "$user" "$details"
        fi
    done
    
    echo
    
    # Generate statistics
    log "Rotation statistics:"
    local total_rotations
    total_rotations=$(grep -c "PASSWORD_ROTATED\|EMERGENCY_COMPLETED" "$ROTATION_LOG" 2>/dev/null || echo "0")
    
    local emergency_rotations
    emergency_rotations=$(grep -c "EMERGENCY_COMPLETED" "$ROTATION_LOG" 2>/dev/null || echo "0")
    
    echo "  Total rotations: $total_rotations"
    echo "  Emergency rotations: $emergency_rotations"
    echo "  Last rotation: $(tail -1 "$ROTATION_LOG" | cut -d'|' -f1 2>/dev/null || echo 'Never')"
    
    # Check rotation compliance (90 days)
    local ninety_days_ago
    ninety_days_ago=$(date -u -d "90 days ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-90d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
    
    if [ -n "$ninety_days_ago" ]; then
        local recent_rotations
        recent_rotations=$(awk -F'|' "\$1 > \"$ninety_days_ago\" && (\$2 == \"PASSWORD_ROTATED\" || \$2 == \"EMERGENCY_COMPLETED\")" "$ROTATION_LOG" | wc -l)
        
        if [ "$recent_rotations" -eq 0 ]; then
            warn "⚠️  No rotations in the last 90 days - consider rotating passwords"
        else
            success "✅ Recent rotations found (last 90 days: $recent_rotations)"
        fi
    fi
}

# Set up rotation reminders
setup_rotation_schedule() {
    local interval="${1:-90}"  # days
    
    bold "📅 Setting up rotation reminders (every $interval days)"
    
    # Create reminder script
    local reminder_script="$SCRIPT_DIR/rotation-reminder.sh"
    
    cat > "$reminder_script" << EOF
#!/bin/bash
# Auto-generated rotation reminder script

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
ROTATION_SCRIPT="\$SCRIPT_DIR/rotate-secrets.sh"

echo "🔔 Scheduled password rotation reminder"
echo "Recommended: Rotate vault passwords every $interval days"
echo
echo "To rotate passwords:"
echo "  \$ROTATION_SCRIPT rotate development"
echo "  \$ROTATION_SCRIPT rotate staging"
echo "  \$ROTATION_SCRIPT rotate production"
echo
echo "To check rotation history:"
echo "  \$ROTATION_SCRIPT audit"
echo
EOF
    
    chmod +x "$reminder_script"
    success "Created reminder script: $reminder_script"
    
    # Try to set up cron job (optional)
    if command -v crontab &> /dev/null; then
        local cron_entry="0 9 1 * * $reminder_script"
        
        echo
        bold "Optional: Add to crontab for automatic reminders"
        echo "Run: crontab -e"
        echo "Add: $cron_entry"
        echo
    fi
    
    log "Manual reminder setup complete"
}

# Main execution
main() {
    local command="${1:-}"
    
    case "$command" in
        "rotate")
            local environment="${2:-}"
            local force=""
            
            # Parse additional options
            shift 2 2>/dev/null || shift $# 2>/dev/null
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --force)
                        force="true"
                        shift
                        ;;
                    --generate)
                        export ROTATION_GENERATE_PASSWORD="true"
                        shift
                        ;;
                    --update-cicd)
                        export UPDATE_CICD="true"
                        shift
                        ;;
                    *)
                        error "Unknown option: $1"
                        exit 1
                        ;;
                esac
            done
            
            if [ -z "$environment" ]; then
                error "Environment required for rotation"
                echo "Usage: rotate-secrets.sh rotate <environment> [--force] [--generate] [--update-cicd]"
                exit 1
            fi
            
            rotate_password "$environment" "$force"
            ;;
            
        "emergency")
            local environment="${2:-}"
            if [ -z "$environment" ]; then
                error "Environment required for emergency rotation"
                echo "Usage: rotate-secrets.sh emergency <environment>"
                exit 1
            fi
            emergency_rotation "$environment"
            ;;
            
        "audit")
            local environment="${2:-all}"
            audit_rotations "$environment"
            ;;
            
        "schedule")
            local interval="${2:-90}"
            setup_rotation_schedule "$interval"
            ;;
            
        "help"|"")
            cat << 'EOF'

Elevate Secrets Rotation

Usage:
  rotate-secrets.sh <command> [options]

Commands:
  rotate <env> [options]        Rotate vault password
                                Options:
                                  --force         Override password strength checks
                                  --generate      Auto-generate strong password
                                  --update-cicd   Update CI/CD environment variables

  emergency <env>               Emergency rotation (compromised password)

  audit [env]                   Show rotation history and compliance
                                env: all|development|staging|production

  schedule [days]               Set up rotation reminders (default: 90 days)

  help                          Show this help

Examples:
  # Standard password rotation
  ./rotate-secrets.sh rotate production

  # Generate password and update CI/CD
  ./rotate-secrets.sh rotate production --generate --update-cicd

  # Emergency rotation
  ./rotate-secrets.sh emergency development

  # Audit all environments
  ./rotate-secrets.sh audit

  # Set up 60-day rotation reminders
  ./rotate-secrets.sh schedule 60

Environment Variables:
  VAULT_OLD_PASSWORD           Current password (for automation)
  VAULT_NEW_PASSWORD           New password (for automation)
  ROTATION_GENERATE_PASSWORD   Auto-generate password (true/false)
  UPDATE_CICD                  Update CI/CD secrets (true/false)
  CICD_PLATFORM               CI/CD platform (vercel|github|railway)

Security Best Practices:
  • Rotate passwords every 90 days minimum
  • Use emergency rotation for compromised passwords
  • Always verify new passwords work before distribution
  • Update CI/CD secrets immediately after rotation
  • Document rotation events for compliance

EOF
            ;;
            
        *)
            error "Unknown command: $command"
            echo "Run 'rotate-secrets.sh help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main with all arguments
main "$@"