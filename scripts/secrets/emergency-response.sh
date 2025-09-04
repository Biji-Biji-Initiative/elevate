#!/bin/bash

# =============================================================================
# Elevate Emergency Security Response Script
# =============================================================================
# Implements comprehensive incident response procedures for the MS Elevate LEAPS
# Tracker when security breaches or secret compromises are detected.
#
# Usage:
#   ./scripts/secrets/emergency-response.sh <incident-type> [options]
#
# Incident Types:
#   secret-leak      - Secrets accidentally committed to repository
#   password-breach  - Master passwords or credentials compromised
#   data-breach      - Potential unauthorized access to systems
#   insider-threat   - Suspicious internal activity
#   system-compromise - Infrastructure compromise detected
# =============================================================================

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INCIDENT_LOG="$PROJECT_ROOT/.incidents/incidents.log"
VAULT_MANAGER="$SCRIPT_DIR/vault-manager.js"
ROTATE_SCRIPT="$SCRIPT_DIR/rotate-secrets.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
BLINK='\033[5m'
NC='\033[0m'

# Logging functions
log() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}" >&2; }
bold() { echo -e "${BOLD}$1${NC}"; }
urgent() { echo -e "${RED}${BLINK}🚨 URGENT: $1${NC}"; }

# Log incidents
log_incident() {
    local incident_type="$1"
    local severity="$2"
    local description="$3"
    local response_actions="$4"
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local incident_id="INC-$(date +%Y%m%d%H%M%S)"
    
    mkdir -p "$(dirname "$INCIDENT_LOG")"
    
    cat >> "$INCIDENT_LOG" << EOF
[$timestamp] $incident_id
Type: $incident_type
Severity: $severity
Reporter: ${USER:-unknown}
Description: $description
Response Actions: $response_actions
Status: ACTIVE
---
EOF
    
    echo "$incident_id"
}

# Check if this is a drill
is_drill() {
    [ "${EMERGENCY_DRILL:-false}" = "true" ] || [ "$1" = "--drill" ]
}

# Validate incident type
validate_incident_type() {
    local incident_type="$1"
    local valid_types=("secret-leak" "password-breach" "data-breach" "insider-threat" "system-compromise")
    
    for valid_type in "${valid_types[@]}"; do
        if [ "$incident_type" = "$valid_type" ]; then
            return 0
        fi
    done
    
    error "Invalid incident type: $incident_type"
    echo "Valid types: ${valid_types[*]}"
    exit 1
}

# Emergency notification
emergency_notification() {
    local incident_id="$1"
    local incident_type="$2"
    local severity="$3"
    
    urgent "SECURITY INCIDENT DETECTED"
    echo
    bold "Incident ID: $incident_id"
    bold "Type: $incident_type"
    bold "Severity: $severity"
    bold "Time: $(date)"
    echo
    
    # Generate notification message
    cat << EOF

========================= SECURITY ALERT =========================

INCIDENT: $incident_id
TYPE: $incident_type
SEVERITY: $severity
TIME: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
SYSTEM: MS Elevate LEAPS Tracker

IMMEDIATE ACTIONS REQUIRED:
1. Do not continue current activities
2. Secure all access to affected systems
3. Contact security team immediately
4. Do not delete or modify evidence
5. Follow incident response procedures

Contact Information:
- Security Team: [EMERGENCY_CONTACT]
- Project Lead: [PROJECT_LEAD_CONTACT]
- System Admin: [ADMIN_CONTACT]

This is an automated alert from the Elevate security system.

==============================================================

EOF
    
    # Try to send notifications (if configured)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        send_slack_notification "$incident_id" "$incident_type" "$severity"
    fi
    
    if [ -n "${EMAIL_NOTIFICATION_LIST:-}" ]; then
        send_email_notification "$incident_id" "$incident_type" "$severity"
    fi
}

# Send Slack notification
send_slack_notification() {
    local incident_id="$1"
    local incident_type="$2"
    local severity="$3"
    
    if command -v curl &> /dev/null; then
        local payload=$(cat << EOF
{
  "text": "🚨 SECURITY INCIDENT: $incident_id",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 Security Incident Alert"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Incident ID:*\n$incident_id"},
        {"type": "mrkdwn", "text": "*Type:*\n$incident_type"},
        {"type": "mrkdwn", "text": "*Severity:*\n$severity"},
        {"type": "mrkdwn", "text": "*System:*\nElevate LEAPS Tracker"}
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Action Required:* Immediate security response needed. Check incident log and follow response procedures."
      }
    }
  ]
}
EOF
)
        
        curl -X POST -H "Content-type: application/json" \
             --data "$payload" \
             "$SLACK_WEBHOOK_URL" &>/dev/null || true
        
        success "Slack notification sent"
    fi
}

# Handle secret leak incident
handle_secret_leak() {
    local severity="${1:-high}"
    
    bold "🔍 Secret Leak Response Protocol"
    
    # Step 1: Assess scope
    log "Step 1: Assessing leak scope..."
    
    # Run enhanced secret scan
    log "Running comprehensive secret scan..."
    if node "$PROJECT_ROOT/scripts/scan-secrets.js" --verbose --report --json > /tmp/leak-scan-results.json; then
        local leak_count=0
    else
        local leak_count=$(jq -r '.summary.total' /tmp/leak-scan-results.json 2>/dev/null || echo "unknown")
    fi
    
    echo "Potential leaks detected: $leak_count"
    
    # Step 2: Immediate containment
    log "Step 2: Immediate containment..."
    
    # Check git history for recent commits
    if [ -d "$PROJECT_ROOT/.git" ]; then
        warn "Checking recent git commits for secrets..."
        
        # Get recent commits
        local recent_commits=$(git -C "$PROJECT_ROOT" log --oneline -10)
        echo "Recent commits:"
        echo "$recent_commits"
        
        bold "CRITICAL: If secrets were committed to git:"
        echo "1. DO NOT push to remote repositories"
        echo "2. Consider git history rewriting (git filter-branch)"
        echo "3. Rotate all potentially exposed credentials"
        echo "4. Contact repository administrators"
    fi
    
    # Step 3: Credential rotation
    log "Step 3: Emergency credential rotation..."
    
    local environments=("development" "staging" "production")
    for env in "${environments[@]}"; do
        local vault_file="$PROJECT_ROOT/.secrets/${env}.vault"
        if [ -f "$vault_file" ]; then
            warn "Environment $env vault exists - consider emergency rotation"
            echo "  Command: $ROTATE_SCRIPT emergency $env"
        fi
    done
    
    # Step 4: Evidence preservation
    log "Step 4: Preserving evidence..."
    
    local evidence_dir="$PROJECT_ROOT/.incidents/evidence-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$evidence_dir"
    
    # Copy scan results
    cp /tmp/leak-scan-results.json "$evidence_dir/secret-scan.json" 2>/dev/null || true
    
    # Git information
    if [ -d "$PROJECT_ROOT/.git" ]; then
        git -C "$PROJECT_ROOT" log --oneline -20 > "$evidence_dir/recent-commits.txt" || true
        git -C "$PROJECT_ROOT" status --porcelain > "$evidence_dir/git-status.txt" || true
        git -C "$PROJECT_ROOT" diff HEAD~5..HEAD > "$evidence_dir/recent-diff.patch" || true
    fi
    
    success "Evidence preserved in: $evidence_dir"
    
    # Step 5: Generate response plan
    log "Step 5: Generating response plan..."
    
    cat > "$evidence_dir/response-plan.txt" << EOF
Secret Leak Incident Response Plan
Generated: $(date)

IMMEDIATE ACTIONS (0-1 hours):
□ Stop all deployments and releases
□ Rotate all potentially compromised credentials
□ Review git history for exposure scope
□ Notify security team and stakeholders
□ Secure access to affected systems

SHORT-TERM ACTIONS (1-24 hours):
□ Audit all access logs for suspicious activity
□ Update all team members on new credentials
□ Review and update access controls
□ Implement additional monitoring
□ Document lessons learned

LONG-TERM ACTIONS (1-7 days):
□ Conduct security review of entire system
□ Update security procedures and training
□ Implement additional safeguards
□ Schedule follow-up security assessment
□ Update incident response procedures

CREDENTIALS TO ROTATE:
$(for env in "${environments[@]}"; do
    if [ -f "$PROJECT_ROOT/.secrets/${env}.vault" ]; then
        echo "- $env environment vault password"
    fi
done)
- Database credentials
- API keys (Clerk, Supabase, Kajabi, Resend, etc.)
- Webhook secrets
- CI/CD tokens
- Third-party integrations

MONITORING POINTS:
- Database access logs
- API usage patterns
- Authentication attempts
- Webhook deliveries
- CI/CD pipeline activity
EOF
    
    success "Response plan generated: $evidence_dir/response-plan.txt"
    
    return "$evidence_dir"
}

# Handle password breach
handle_password_breach() {
    local severity="${1:-critical}"
    
    bold "🔐 Password Breach Response Protocol"
    
    # Step 1: Immediate lockdown
    urgent "IMMEDIATE ACTION: All vault passwords must be rotated NOW"
    
    local environments=("production" "staging" "development")
    local rotation_results=()
    
    for env in "${environments[@]}"; do
        local vault_file="$PROJECT_ROOT/.secrets/${env}.vault"
        if [ -f "$vault_file" ]; then
            warn "Rotating $env environment vault..."
            
            if is_drill; then
                success "DRILL: Would rotate $env vault password"
                rotation_results+=("$env:DRILL_SUCCESS")
            else
                # Attempt emergency rotation
                if "$ROTATE_SCRIPT" emergency "$env"; then
                    success "Emergency rotation completed for $env"
                    rotation_results+=("$env:SUCCESS")
                else
                    error "Emergency rotation failed for $env"
                    rotation_results+=("$env:FAILED")
                fi
            fi
        else
            warn "No vault found for $env environment"
            rotation_results+=("$env:NO_VAULT")
        fi
    done
    
    # Step 2: Update CI/CD systems
    log "Step 2: Updating CI/CD systems..."
    
    if [ -n "${VERCEL_TOKEN:-}" ]; then
        warn "Vercel environment variables need manual update"
        echo "Check: https://vercel.com/dashboard/project/settings/environment-variables"
    fi
    
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        warn "GitHub Actions secrets need manual update"
        echo "Check: Repository Settings > Secrets and variables > Actions"
    fi
    
    # Step 3: Team notification
    log "Step 3: Team notification template..."
    
    cat << EOF

=== URGENT TEAM NOTIFICATION ===

Subject: EMERGENCY: All vault passwords rotated - immediate action required

Team,

Due to a security incident, all vault passwords have been emergency rotated.

IMMEDIATE ACTION REQUIRED:
1. Stop all development work
2. Pull latest changes from repository
3. Run: ./scripts/secrets/setup-dev-secrets.sh [environment] onboard
4. Get new passwords from security team through secure channel
5. Verify your development environment works
6. Report any issues immediately

Rotation Results:
$(for result in "${rotation_results[@]}"; do
    echo "- $result"
done)

DO NOT:
- Use old passwords
- Share passwords through insecure channels
- Continue development until confirmation

Contact [SECURITY_TEAM] immediately if you have questions.

This is a security incident. Please treat with urgency.

===================================

EOF
}

# Handle data breach
handle_data_breach() {
    local severity="${1:-critical}"
    
    bold "💾 Data Breach Response Protocol"
    
    # Step 1: System isolation
    urgent "CRITICAL: Systems may be compromised"
    
    log "Step 1: System isolation assessment..."
    
    # Check for suspicious database activity
    if [ -n "${DATABASE_URL:-}" ]; then
        warn "Check database logs for suspicious activity"
        echo "Monitor: Login attempts, data exports, schema changes"
    fi
    
    # Check application logs
    local log_locations=(
        "$PROJECT_ROOT/logs"
        "/var/log/elevate"
        "$HOME/.pm2/logs"
    )
    
    for log_dir in "${log_locations[@]}"; do
        if [ -d "$log_dir" ]; then
            warn "Check application logs: $log_dir"
        fi
    done
    
    # Step 2: Access review
    log "Step 2: Access review..."
    
    # Review recent authentication events
    if command -v clerk &> /dev/null; then
        warn "Review Clerk authentication logs"
        echo "Check: https://dashboard.clerk.com/apps/[app-id]/events"
    fi
    
    # Review database access
    warn "Review database access patterns"
    echo "Focus on: Unusual queries, bulk exports, admin operations"
    
    # Step 3: Data assessment
    log "Step 3: Data exposure assessment..."
    
    cat << EOF

POTENTIAL DATA EXPOSURE POINTS:
□ User authentication data (Clerk managed)
□ Submission evidence files (Supabase Storage)
□ User profiles and progress data
□ Email addresses and contact information
□ Learning activity logs
□ Administrative audit trails

IMMEDIATE VERIFICATION NEEDED:
□ Supabase access logs and permissions
□ File storage access patterns
□ Database query logs
□ API usage patterns
□ Backup integrity and security

REGULATORY CONSIDERATIONS:
□ GDPR notification requirements (72 hours)
□ Local privacy law requirements
□ User notification obligations
□ Documentation and evidence preservation

EOF
    
    # Step 4: Communication plan
    log "Step 4: Communication planning..."
    
    cat << EOF

COMMUNICATION STAKEHOLDERS:
1. Internal Team (immediate)
2. Microsoft Elevate Program (within 2 hours)
3. Legal/Compliance Team (within 4 hours)
4. Affected Users (as determined by legal)
5. Regulatory Bodies (as required)

COMMUNICATION TEMPLATES:
- Internal incident report
- Executive briefing
- Legal notification
- User communication (if required)
- Public statement (if required)

EOF
}

# Handle insider threat
handle_insider_threat() {
    local severity="${1:-high}"
    
    bold "👤 Insider Threat Response Protocol"
    
    warn "SENSITIVE: This response involves potential internal security issues"
    
    log "Step 1: Evidence preservation..."
    
    # Preserve audit logs
    local evidence_dir="$PROJECT_ROOT/.incidents/insider-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$evidence_dir"
    chmod 700 "$evidence_dir"
    
    # System access logs
    if [ -f "$PROJECT_ROOT/.secrets/rotation.log" ]; then
        cp "$PROJECT_ROOT/.secrets/rotation.log" "$evidence_dir/rotation-history.log"
    fi
    
    # Git activity
    if [ -d "$PROJECT_ROOT/.git" ]; then
        git -C "$PROJECT_ROOT" log --all --full-history --source --date=iso > "$evidence_dir/git-full-history.log" || true
    fi
    
    log "Step 2: Access review..."
    
    # Review recent system access
    warn "Review system access patterns:"
    echo "- Unusual login times or locations"
    echo "- Bulk data access or downloads"
    echo "- Administrative privilege usage"
    echo "- Vault or secret access attempts"
    echo "- CI/CD pipeline modifications"
    
    log "Step 3: Containment measures..."
    
    cat << EOF

CONTAINMENT CHECKLIST:
□ Review and potentially revoke access credentials
□ Monitor ongoing system activity
□ Preserve all audit trails and logs
□ Document timeline of suspicious activities
□ Coordinate with HR/Legal as appropriate

DO NOT:
- Confront suspected individuals directly
- Modify systems that could destroy evidence
- Discuss investigation with unauthorized personnel
- Take action that could alert potential threat

ESCALATION:
Contact appropriate authorities and legal team before
taking any personnel-related actions.

EOF
}

# Handle system compromise
handle_system_compromise() {
    local severity="${1:-critical}"
    
    bold "🖥️  System Compromise Response Protocol"
    
    urgent "CRITICAL: Infrastructure compromise detected"
    
    log "Step 1: Immediate isolation..."
    
    if is_drill; then
        success "DRILL: Would implement emergency containment"
    else
        # Emergency containment measures
        warn "Consider immediate actions:"
        echo "1. Isolate affected systems from network"
        echo "2. Preserve system state for forensics"
        echo "3. Switch to backup/disaster recovery systems"
        echo "4. Block potentially compromised accounts"
    fi
    
    log "Step 2: Infrastructure assessment..."
    
    # Check hosting platforms
    if [ -n "${VERCEL_TOKEN:-}" ]; then
        warn "Check Vercel deployment logs and access"
        echo "Review: https://vercel.com/dashboard/activity"
    fi
    
    if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
        warn "Check Supabase project logs and access"
        echo "Review project dashboard for suspicious activity"
    fi
    
    # Check CI/CD systems
    warn "Review CI/CD pipeline security:"
    echo "- GitHub Actions workflow runs"
    echo "- Environment variable changes"
    echo "- Repository access and permissions"
    echo "- Deployment history and artifacts"
    
    log "Step 3: Forensic preparation..."
    
    cat << EOF

FORENSIC EVIDENCE COLLECTION:
□ System snapshots before any changes
□ Network traffic logs
□ Authentication and access logs
□ Application-specific logs
□ Database transaction logs
□ File system integrity checks

EXTERNAL RESOURCES TO CONTACT:
□ Cloud provider security teams
□ Third-party security services
□ Law enforcement (if criminal activity suspected)
□ Cyber insurance provider
□ Incident response consultants

BUSINESS CONTINUITY:
□ Activate disaster recovery procedures
□ Communicate with stakeholders
□ Implement alternative systems if available
□ Document all response actions

EOF
}

# Generate incident summary
generate_incident_summary() {
    local incident_id="$1"
    local incident_type="$2"
    local severity="$3"
    local evidence_dir="${4:-}"
    
    local summary_file="$PROJECT_ROOT/.incidents/${incident_id}-summary.txt"
    
    cat > "$summary_file" << EOF
SECURITY INCIDENT SUMMARY
========================

Incident ID: $incident_id
Type: $incident_type
Severity: $severity
Reported: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Reporter: ${USER:-unknown}
System: MS Elevate LEAPS Tracker

INITIAL RESPONSE ACTIONS:
- Emergency response script executed
- Incident logged and tracked
- Evidence preservation initiated
- Stakeholder notification triggered
$([ -n "$evidence_dir" ] && echo "- Evidence directory: $evidence_dir")

NEXT STEPS:
1. Follow incident-specific response procedures
2. Continue evidence collection and analysis
3. Coordinate with appropriate teams and authorities
4. Implement containment and remediation measures
5. Document all actions and decisions
6. Conduct post-incident review and lessons learned

CONTACTS:
- Incident ID for reference: $incident_id
- Evidence location: $([ -n "$evidence_dir" ] && echo "$evidence_dir" || echo "See incident log")
- Response script: $0

This summary was generated automatically.
Update manually as response progresses.
EOF
    
    success "Incident summary: $summary_file"
    return "$summary_file"
}

# Main execution
main() {
    local incident_type="${1:-}"
    local severity="${2:-medium}"
    local is_drill_mode=false
    
    # Check for drill mode
    if is_drill "$@"; then
        is_drill_mode=true
        bold "🎯 EMERGENCY RESPONSE DRILL MODE"
        warn "This is a training exercise - no actual changes will be made"
        echo
    fi
    
    # Validate incident type
    if [ -z "$incident_type" ] || [ "$incident_type" = "help" ]; then
        cat << 'EOF'

Elevate Emergency Security Response

Usage:
  emergency-response.sh <incident-type> [severity] [--drill]

Incident Types:
  secret-leak       Secrets accidentally committed to repository
  password-breach   Master passwords or credentials compromised
  data-breach       Potential unauthorized access to systems
  insider-threat    Suspicious internal activity
  system-compromise Infrastructure compromise detected

Severity Levels:
  low, medium, high, critical (default: medium)

Options:
  --drill          Run in drill mode (no actual changes)

Examples:
  # Report a secret leak
  ./emergency-response.sh secret-leak high

  # Practice password breach response
  ./emergency-response.sh password-breach critical --drill

  # Report system compromise
  EMERGENCY_CONTACT="security@company.com" ./emergency-response.sh system-compromise critical

Environment Variables:
  EMERGENCY_DRILL         Set to "true" for drill mode
  SLACK_WEBHOOK_URL       Slack notification endpoint
  EMAIL_NOTIFICATION_LIST Email addresses for alerts
  EMERGENCY_CONTACT       Primary emergency contact

For detailed incident response procedures, see SECRETS_MANAGEMENT.md

EOF
        exit 0
    fi
    
    validate_incident_type "$incident_type"
    
    # Log the incident
    local incident_id
    incident_id=$(log_incident "$incident_type" "$severity" "Incident reported via emergency response script" "Automated response initiated")
    
    # Send notifications
    emergency_notification "$incident_id" "$incident_type" "$severity"
    
    # Execute incident-specific response
    local evidence_dir=""
    case "$incident_type" in
        "secret-leak")
            evidence_dir=$(handle_secret_leak "$severity")
            ;;
        "password-breach")
            handle_password_breach "$severity"
            ;;
        "data-breach")
            handle_data_breach "$severity"
            ;;
        "insider-threat")
            handle_insider_threat "$severity"
            ;;
        "system-compromise")
            handle_system_compromise "$severity"
            ;;
    esac
    
    # Generate summary
    local summary_file
    summary_file=$(generate_incident_summary "$incident_id" "$incident_type" "$severity" "$evidence_dir")
    
    echo
    if [ "$is_drill_mode" = "true" ]; then
        success "🎯 DRILL COMPLETED"
        echo "This was a training exercise. Review the generated response plan and procedures."
    else
        bold "🚨 EMERGENCY RESPONSE INITIATED"
        echo "Incident ID: $incident_id"
        echo "Follow the response procedures and document all actions."
    fi
    
    echo
    bold "Critical files:"
    echo "- Incident log: $INCIDENT_LOG"
    echo "- Summary: $summary_file"
    [ -n "$evidence_dir" ] && echo "- Evidence: $evidence_dir"
    
    echo
    bold "Continue response according to generated procedures."
    bold "Contact emergency responders and follow organizational policies."
}

# Execute main with all arguments
main "$@"