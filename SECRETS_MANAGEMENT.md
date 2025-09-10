# Secrets Management Guide

## MS Elevate LEAPS Tracker - Comprehensive Secrets Management Strategy

This document outlines the complete secrets management strategy for the MS Elevate LEAPS Tracker project, providing secure handling of sensitive data while maintaining developer productivity and operational excellence.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Production Management](#production-management)
- [CI/CD Integration](#cicd-integration)
- [Security Features](#security-features)
- [Team Onboarding](#team-onboarding)
- [Emergency Procedures](#emergency-procedures)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Reference](#reference)

## Overview

The Elevate secrets management system provides:

- **🔐 Encrypted Storage**: AES-256-GCM encryption for all secrets at rest
- **🔄 Key Rotation**: Automated and emergency password rotation procedures
- **🛡️ Secret Scanning**: Comprehensive detection of accidental secret exposure
- **👥 Team Sharing**: Secure distribution of secrets to team members
- **🚨 Incident Response**: Automated emergency response for security breaches
- **📋 Audit Trail**: Complete logging of all secret access and modifications
- **🔗 CI/CD Integration**: Seamless deployment to production environments

### Key Principles

1. **Security by Design**: All secrets encrypted with strong cryptography
2. **Zero Trust**: No secrets stored in plaintext anywhere
3. **Least Privilege**: Access controls based on role and need
4. **Defense in Depth**: Multiple layers of protection
5. **Audit Everything**: Complete trail of all secret operations
6. **Fail Secure**: System defaults to secure state on errors

## Architecture

### Three-Layer Environment System

The secrets management system integrates with the existing three-layer environment strategy:

````

### Documentation & Sample Keys (Avoid False Positives)

When documenting environment variables in READMEs or guides, use neutral placeholders instead of values that look like real keys (e.g., avoid prefixes like `pk_`, `sk_`, `whsec_`). Example:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
RESEND_API_KEY=<your-resend-api-key>
OPENAI_API_KEY=<your-openai-api-key>
````

This prevents secret scanners from flagging docs and keeps CI green while conveying the intent clearly.

1. Repository Defaults (.env.defaults) - Safe defaults, version controlled
2. Environment Specific (.env.production) - Environment config, version controlled
3. Local Overrides (.env.local) - Secrets and overrides, gitignored

```

### Encrypted Vault Layer

A fourth layer provides encrypted secret storage:

```

4. Encrypted Vaults (.secrets/\*.vault) - AES-256-GCM encrypted secrets

```

### Directory Structure

```

elevate/
├── .secrets/ # Encrypted vault directory
│ ├── development.vault # Development environment secrets
│ ├── staging.vault # Staging environment secrets
│ ├── production.vault # Production environment secrets
│ └── rotation.log # Password rotation audit log
├── .env-local/ # Local development directory
│ └── README.md # Setup instructions
├── scripts/secrets/ # Secret management tools
│ ├── vault-manager.js # Core vault operations
│ ├── setup-dev-secrets.sh # Development setup script
│ ├── team-share.sh # Team distribution tools
│ ├── rotate-secrets.sh # Password rotation tools
│ └── emergency-response.sh # Incident response procedures
├── .env.defaults # Repository defaults (committed)
├── .env.production # Production config (committed)
├── .env.local # Local secrets (gitignored)
└── .secrets-allowlist.json # Secret scanner allowlist

````

## Quick Start

### For New Team Members

1. **Get the vault files** from your team lead:
   ```bash
   # Receive the team secrets package
   # Extract to your project root
````

2. **Run the onboarding script**:

   ```bash
   ./scripts/secrets/setup-dev-secrets.sh development onboard
   ```

3. **Enter master password** when prompted (get from team lead)

4. **Verify setup**:
   ```bash
   pnpm env:validate
   pnpm dev
   ```

### For Existing Team Members

1. **Standard setup**:

   ```bash
   ./scripts/secrets/setup-dev-secrets.sh development
   ```

2. **Or extract secrets manually**:
   ```bash
   node scripts/secrets/vault-manager.js extract development
   ```

## Development Workflow

### Daily Development

1. **Start development**:

   ```bash
   # Ensure secrets are current
   ./scripts/secrets/setup-dev-secrets.sh development

   # Start development servers
   pnpm dev
   ```

2. **Validate environment**:

   ```bash
   # Check environment variables
   pnpm env:validate

   # Scan for accidental secret leaks
   pnpm verify:secrets
   ```

3. **Before committing**:

   ```bash
   # Always run secret scan before commits
   node scripts/scan-secrets.js --verbose

   # Validate code quality
   pnpm verify:code-quality
   ```

### Creating Vaults

When setting up new environments:

```bash
# Create vault from existing .env files
node scripts/secrets/vault-manager.js create production

# Generate strong master password
node scripts/secrets/vault-manager.js generate-password

# List available vaults
node scripts/secrets/vault-manager.js list
```

### Sharing with Team

```bash
# Create team package for all environments
./scripts/secrets/team-share.sh package all

# Create package for specific environment
./scripts/secrets/team-share.sh package development ./dev-package

# Verify vault integrity
./scripts/secrets/team-share.sh verify all
```

## Production Management

### Deployment Integration

#### Vercel Deployment

```bash
# Deploy vault to Vercel environment
VAULT_MASTER_PASSWORD="..." ./scripts/secrets/team-share.sh deploy production vercel

# Manual environment variable setup
echo "VAULT_CONTENT" | base64 -d > .secrets/production.vault
VAULT_MASTER_PASSWORD="..." node scripts/secrets/vault-manager.js extract production
```

#### GitHub Actions Integration

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Setup production secrets
  run: |
    echo "${{ secrets.SECRETS_VAULT_PRODUCTION }}" | base64 -d > .secrets/production.vault
    VAULT_MASTER_PASSWORD="${{ secrets.VAULT_MASTER_PASSWORD_PRODUCTION }}" \
      node scripts/secrets/vault-manager.js extract production

- name: Validate environment
  run: pnpm env:validate --environment production
```

#### Railway Deployment

Set environment variables:

- `SECRETS_VAULT_PRODUCTION`: Base64 encoded vault content
- `VAULT_MASTER_PASSWORD_PRODUCTION`: Master password

Build command:

```bash
echo "$SECRETS_VAULT_PRODUCTION" | base64 -d > .secrets/production.vault && \
VAULT_MASTER_PASSWORD="$VAULT_MASTER_PASSWORD_PRODUCTION" \
  node scripts/secrets/vault-manager.js extract production && \
pnpm build
```

### Password Rotation

#### Regular Rotation (Every 90 Days)

```bash
# Rotate with new password
./scripts/secrets/rotate-secrets.sh rotate production

# Generate password automatically
./scripts/secrets/rotate-secrets.sh rotate production --generate

# Update CI/CD systems automatically
./scripts/secrets/rotate-secrets.sh rotate production --generate --update-cicd
```

#### Emergency Rotation

```bash
# Emergency rotation (compromised password)
./scripts/secrets/rotate-secrets.sh emergency production
```

#### Schedule Reminders

```bash
# Set up 90-day rotation reminders
./scripts/secrets/rotate-secrets.sh schedule 90

# Check rotation compliance
./scripts/secrets/rotate-secrets.sh audit
```

## CI/CD Integration

### Environment Variables Required

For each environment (`development`, `staging`, `production`):

| Variable                    | Description               | Example              |
| --------------------------- | ------------------------- | -------------------- |
| `SECRETS_VAULT_ENV`         | Base64 encoded vault file | `eyJlbmNyeXB0ZWQ...` |
| `VAULT_MASTER_PASSWORD_ENV` | Vault decryption password | `SecurePassword123!` |

### Build Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "build:with-secrets": "node scripts/setup-ci-secrets.js && pnpm build",
    "deploy:production": "node scripts/setup-ci-secrets.js production && pnpm deploy"
  }
}
```

### Vercel Configuration

`vercel.json`:

```json
{
  "buildCommand": "node scripts/setup-ci-secrets.js production && pnpm build",
  "env": {
    "SECRETS_VAULT_PRODUCTION": "@secrets-vault-production",
    "VAULT_MASTER_PASSWORD_PRODUCTION": "@vault-password-production"
  }
}
```

## Security Features

### Secret Scanning

The enhanced secret scanner provides:

- **Pattern Detection**: 15+ secret patterns with severity levels
- **Context Analysis**: Line-by-line analysis with false positive filtering
- **Allowlisting**: Configure exceptions for legitimate patterns
- **Reporting**: JSON reports for CI/CD integration
- **Categories**: API keys, tokens, databases, webhooks, etc.

#### Usage Examples

```bash
# Basic scan
node scripts/scan-secrets.js

# Verbose output with context
node scripts/scan-secrets.js --verbose

# Filter by severity
node scripts/scan-secrets.js --severity critical

# Generate JSON report
node scripts/scan-secrets.js --json --report

# Check specific patterns
node scripts/scan-secrets.js --severity high --verbose
```

#### Allowlist Configuration

Create `.secrets-allowlist.json`:

```json
{
  "files": ["tests/fixtures/example.test.js", "docs/api-examples.md"],
  "patterns": ["tests/mock-data.js:api-key", "docs/examples.md:token"],
  "hashes": ["a1b2c3d4e5f6g7h8", "x9y8z7w6v5u4t3s2"]
}
```

### Encryption Details

- **Algorithm**: AES-256-GCM (Authenticated encryption)
- **Key Derivation**: PBKDF2 with 100,000 rounds
- **Salt**: 32 bytes random per vault
- **IV**: 12 bytes random per encryption
- **Authentication**: Built-in authentication tag verification

### Access Controls

- **File Permissions**: All vault files set to 600 (owner read/write only)
- **Directory Permissions**: Secret directories set to 700 (owner access only)
- **Git Integration**: Automatic .gitignore updates
- **Audit Logging**: All operations logged with timestamps and user info

## Team Onboarding

### New Developer Setup

1. **Prerequisites**:

   - Node.js 18+ installed
   - Git access to repository
   - Team lead contact for passwords

2. **Initial Setup**:

   ```bash
   # Clone repository
   git clone [repository-url]
   cd elevate

   # Install dependencies
   pnpm install

   # Run onboarding
   ./scripts/secrets/setup-dev-secrets.sh development onboard
   ```

3. **Verification**:

   ```bash
   # Check environment
   pnpm env:validate

   # Test development servers
   pnpm dev

   # Verify secret scanner works
   pnpm verify:secrets
   ```

### Team Lead Setup

1. **Create initial vaults**:

   ```bash
   # For each environment
   node scripts/secrets/vault-manager.js create development
   node scripts/secrets/vault-manager.js create staging
   node scripts/secrets/vault-manager.js create production
   ```

2. **Generate team package**:

   ```bash
   ./scripts/secrets/team-share.sh package all ./team-secrets-package
   ```

3. **Distribute securely**:
   - Share vault files through secure channels
   - Provide master passwords separately
   - Document emergency contacts
   - Set up rotation schedule

### Security Training

Team members should understand:

- **Never commit secrets** to version control
- **Use environment variables** for all sensitive data
- **Rotate passwords regularly** (90-day maximum)
- **Report security incidents** immediately
- **Follow incident response procedures**
- **Keep master passwords secure**

## Emergency Procedures

### Incident Types and Responses

#### Secret Leak (Accidental commit)

```bash
# Immediate response
./scripts/secrets/emergency-response.sh secret-leak critical

# Manual steps
1. Stop all deployments
2. Rotate all potentially exposed credentials
3. Review git history for exposure scope
4. Notify team and stakeholders
5. Follow generated response plan
```

#### Password Breach (Compromised master password)

```bash
# Emergency rotation
./scripts/secrets/emergency-response.sh password-breach critical

# Manual steps
1. Rotate all vault passwords immediately
2. Update CI/CD systems
3. Notify all team members
4. Verify new passwords work
5. Document incident
```

#### Data Breach (Unauthorized system access)

```bash
# Full incident response
./scripts/secrets/emergency-response.sh data-breach critical

# Manual steps
1. Isolate affected systems
2. Preserve evidence and logs
3. Review access patterns
4. Notify relevant authorities
5. Implement containment measures
```

#### System Compromise (Infrastructure breach)

```bash
# Critical system response
./scripts/secrets/emergency-response.sh system-compromise critical

# Manual steps
1. Immediate system isolation
2. Activate disaster recovery
3. Contact security teams
4. Preserve forensic evidence
5. Implement business continuity
```

### Emergency Contacts

Configure these environment variables for automated alerts:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
export EMAIL_NOTIFICATION_LIST="security@company.com,team@company.com"
export EMERGENCY_CONTACT="security-team@company.com"
```

### Drill Testing

Practice emergency procedures regularly:

```bash
# Run drill for any incident type
./scripts/secrets/emergency-response.sh password-breach critical --drill

# This will:
# - Test response procedures without making changes
# - Generate response plans
# - Verify notification systems
# - Document lessons learned
```

## Best Practices

### Development

1. **Environment Separation**:

   - Use separate credentials for each environment
   - Never use production secrets in development
   - Regularly validate environment configurations

2. **Secret Hygiene**:

   - Run secret scans before every commit
   - Use meaningful names for environment variables
   - Document required secrets in `.env.defaults`

3. **Access Control**:
   - Limit access to production secrets
   - Use read-only credentials where possible
   - Implement time-limited access tokens

### Operations

1. **Monitoring**:

   - Monitor secret usage patterns
   - Alert on unusual access patterns
   - Regular security assessments

2. **Backup and Recovery**:

   - Secure backup of vault files
   - Test recovery procedures regularly
   - Document disaster recovery plans

3. **Compliance**:
   - Maintain audit trails
   - Regular compliance checks
   - Document security procedures

### Team Management

1. **Onboarding**:

   - Standardized security training
   - Clear documentation and procedures
   - Mentor assignment for new team members

2. **Ongoing Education**:

   - Regular security awareness training
   - Share security best practices
   - Learn from security incidents

3. **Communication**:
   - Clear incident escalation procedures
   - Regular security discussions
   - Open communication about security concerns

## Troubleshooting

### Common Issues

#### "Vault not found" error

```bash
# Check if vault exists
ls -la .secrets/

# Verify environment name
node scripts/secrets/vault-manager.js list

# Get vault from team
./scripts/secrets/setup-dev-secrets.sh development onboard
```

#### "Wrong password" error

```bash
# Verify password with team lead
# Check for recent password rotations
./scripts/secrets/rotate-secrets.sh audit

# Reset with correct password
VAULT_MASTER_PASSWORD="correct_password" \
  node scripts/secrets/vault-manager.js extract development
```

#### Environment validation failures

```bash
# Check specific validation errors
node scripts/validate-env.js --verbose

# Verify extracted secrets
cat .env.development.local

# Check for missing or placeholder values
grep -i placeholder .env.development.local
```

#### Permission errors

```bash
# Fix file permissions
chmod 600 .secrets/*.vault
chmod 700 .secrets/
chmod 600 .env.*.local

# Fix directory permissions
find .env-local -type f -exec chmod 600 {} \;
find .env-local -type d -exec chmod 700 {} \;
```

### Secret Scanner Issues

#### False positives

Create `.secrets-allowlist.json`:

```json
{
  "files": ["path/to/test/file.js"],
  "patterns": ["file.js:api-key"],
  "hashes": ["specific-hash-from-scan"]
}
```

#### Missing patterns

Add custom patterns to `scripts/scan-secrets.js`:

```javascript
const CUSTOM_PATTERNS = [
  {
    re: /your-custom-pattern/gi,
    why: 'Description of pattern',
    severity: 'high',
    category: 'custom',
  },
]
```

### CI/CD Issues

#### Environment variables not set

```bash
# Verify environment variables exist
vercel env ls

# Check GitHub secrets
# Go to Repository > Settings > Secrets and variables > Actions
```

#### Build failures with secrets

```bash
# Test locally first
node scripts/secrets/vault-manager.js extract production
pnpm env:validate --environment production

# Check vault content
node scripts/secrets/vault-manager.js list
```

### Emergency Response Issues

#### Cannot rotate passwords

```bash
# Verify current password
VAULT_MASTER_PASSWORD="current_password" \
  node scripts/secrets/vault-manager.js extract development /tmp/test

# Try emergency rotation
./scripts/secrets/rotate-secrets.sh emergency development

# Manual vault recreation if needed
node scripts/secrets/vault-manager.js create development
```

#### Incident response not working

```bash
# Test in drill mode
./scripts/secrets/emergency-response.sh password-breach high --drill

# Check permissions
ls -la scripts/secrets/
chmod +x scripts/secrets/*.sh

# Verify incident log directory
mkdir -p .incidents
chmod 700 .incidents
```

## Reference

### Command Reference

#### Vault Manager

```bash
# Core operations
node scripts/secrets/vault-manager.js create <environment> [password]
node scripts/secrets/vault-manager.js extract <environment> [password] [output-path]
node scripts/secrets/vault-manager.js list
node scripts/secrets/vault-manager.js rotate <environment> <old-password> <new-password>
node scripts/secrets/vault-manager.js generate-password

# Environment variables
VAULT_MASTER_PASSWORD    # Default master password
VAULT_OLD_PASSWORD       # Old password for rotation
VAULT_NEW_PASSWORD       # New password for rotation
```

#### Development Setup

```bash
# Setup commands
./scripts/secrets/setup-dev-secrets.sh [environment] [mode]

# Modes
setup     # Standard setup (default)
onboard   # Guided setup for new team members
help      # Show help information

# Environment variables
VAULT_MASTER_PASSWORD    # Master password for vault decryption
```

#### Team Sharing

```bash
# Sharing commands
./scripts/secrets/team-share.sh package <env> [output-dir]
./scripts/secrets/team-share.sh deploy <env> [platform]
./scripts/secrets/team-share.sh verify [env]

# Platforms
vercel    # Vercel deployment platform
github    # GitHub Actions secrets
railway   # Railway deployment platform
```

#### Password Rotation

```bash
# Rotation commands
./scripts/secrets/rotate-secrets.sh rotate <env> [options]
./scripts/secrets/rotate-secrets.sh emergency <env>
./scripts/secrets/rotate-secrets.sh audit [env]
./scripts/secrets/rotate-secrets.sh schedule [days]

# Options
--force         # Override password strength checks
--generate      # Auto-generate strong password
--update-cicd   # Update CI/CD environment variables
```

#### Secret Scanning

```bash
# Scanning commands
node scripts/scan-secrets.js [options]

# Options
--verbose       # Show detailed output
--json         # JSON output format
--report       # Generate detailed report
--severity <level>  # Filter by severity (critical|high|medium|low|all)
```

#### Emergency Response

```bash
# Incident response
./scripts/secrets/emergency-response.sh <incident-type> [severity] [options]

# Incident types
secret-leak       # Secrets in version control
password-breach   # Compromised passwords
data-breach       # Unauthorized data access
insider-threat    # Internal security issues
system-compromise # Infrastructure compromise

# Options
--drill          # Practice mode (no actual changes)
```

### Environment Variables

#### Core Configuration

| Variable                | Description                          | Default       | Required     |
| ----------------------- | ------------------------------------ | ------------- | ------------ |
| `VAULT_MASTER_PASSWORD` | Master password for vault operations | -             | Yes          |
| `NODE_ENV`              | Environment name                     | `development` | No           |
| `VAULT_OLD_PASSWORD`    | Old password for rotation            | -             | For rotation |
| `VAULT_NEW_PASSWORD`    | New password for rotation            | -             | For rotation |

#### CI/CD Integration

| Variable                            | Description          | Example           |
| ----------------------------------- | -------------------- | ----------------- |
| `SECRETS_VAULT_PRODUCTION`          | Base64 encoded vault | `eyJlbmNyeXB0...` |
| `SECRETS_VAULT_STAGING`             | Base64 encoded vault | `eyJlbmNyeXB0...` |
| `SECRETS_VAULT_DEVELOPMENT`         | Base64 encoded vault | `eyJlbmNyeXB0...` |
| `VAULT_MASTER_PASSWORD_PRODUCTION`  | Production password  | `SecurePass123!`  |
| `VAULT_MASTER_PASSWORD_STAGING`     | Staging password     | `SecurePass123!`  |
| `VAULT_MASTER_PASSWORD_DEVELOPMENT` | Development password | `SecurePass123!`  |

#### Emergency Response

| Variable                  | Description         | Example                       |
| ------------------------- | ------------------- | ----------------------------- |
| `EMERGENCY_DRILL`         | Enable drill mode   | `true`                        |
| `SLACK_WEBHOOK_URL`       | Slack notifications | `https://hooks.slack.com/...` |
| `EMAIL_NOTIFICATION_LIST` | Email alerts        | `team@company.com`            |
| `EMERGENCY_CONTACT`       | Primary contact     | `security@company.com`        |
| `CICD_PLATFORM`           | CI/CD platform      | `vercel`                      |

### File Structure Reference

```
elevate/
├── .secrets/                          # Encrypted vault directory (700)
│   ├── development.vault             # Development secrets (600)
│   ├── staging.vault                 # Staging secrets (600)
│   ├── production.vault              # Production secrets (600)
│   └── rotation.log                  # Rotation audit log (600)
├── .incidents/                       # Incident tracking (700)
│   ├── incidents.log                 # Incident log (600)
│   └── evidence-*/                   # Evidence directories (700)
├── .env-local/                       # Local development (700)
├── scripts/secrets/                  # Management scripts
│   ├── vault-manager.js              # Core vault operations
│   ├── setup-dev-secrets.sh          # Development setup
│   ├── team-share.sh                 # Team distribution
│   ├── rotate-secrets.sh             # Password rotation
│   └── emergency-response.sh         # Incident response
├── .env.defaults                     # Repository defaults (committed)
├── .env.development                  # Development config (committed)
├── .env.staging                      # Staging config (committed)
├── .env.production                   # Production config (committed)
├── .env.local                        # Local secrets (gitignored)
├── .secrets-allowlist.json           # Scanner allowlist (committed)
└── SECRETS_MANAGEMENT.md             # This documentation (committed)
```

### Security Checklist

#### Daily Operations

- [ ] Run secret scan before commits (`pnpm verify:secrets`)
- [ ] Validate environment before development (`pnpm env:validate`)
- [ ] Use environment-specific credentials
- [ ] Keep local environment files secure (600 permissions)

#### Weekly Reviews

- [ ] Check rotation log for overdue passwords
- [ ] Review incident log for security issues
- [ ] Validate team member access is appropriate
- [ ] Update security documentation as needed

#### Monthly Tasks

- [ ] Audit vault access patterns
- [ ] Test emergency response procedures (drill mode)
- [ ] Review and update allowlist for false positives
- [ ] Security training and awareness updates

#### Quarterly Requirements

- [ ] Rotate all vault passwords (maximum 90 days)
- [ ] Conduct full security assessment
- [ ] Update incident response procedures
- [ ] Review compliance with security policies

## Support and Contact

For questions or issues with secrets management:

1. **Documentation**: Check this guide and inline help (`--help`)
2. **Team Lead**: Contact your project lead for passwords and access
3. **Security Team**: Contact security team for incidents or breaches
4. **Emergency**: Use emergency response procedures for critical issues

### Additional Resources

- [Project Documentation](archive/planning/plan/plan2.md) - Complete project requirements
- [Environment Validation](scripts/validate-env.js) - Environment configuration
- [Build System](package.json) - Available scripts and commands
- [Security Scanning](scripts/scan-secrets.js) - Secret detection system

---

**Version**: 1.0  
**Last Updated**: January 2025  
**Maintained By**: MS Elevate Development Team

This documentation is living and should be updated as the system evolves.
