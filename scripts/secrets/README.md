# Elevate Secrets Management Scripts

This directory contains all the scripts and tools for secure secrets management in the MS Elevate LEAPS Tracker project.

## Quick Start

For new team members:
```bash
# Get vault files from team lead, then run:
./setup-dev-secrets.sh development onboard
```

For existing team members:
```bash
# Set up development environment:
./setup-dev-secrets.sh development
```

## Script Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `vault-manager.js` | Core vault operations | `node vault-manager.js <command>` |
| `setup-dev-secrets.sh` | Development environment setup | `./setup-dev-secrets.sh [env] [mode]` |
| `team-share.sh` | Team distribution and verification | `./team-share.sh <command> [options]` |
| `rotate-secrets.sh` | Password rotation and management | `./rotate-secrets.sh <command> [options]` |
| `emergency-response.sh` | Security incident response | `./emergency-response.sh <incident-type> [severity]` |

## Quick Commands

```bash
# List available vaults
node vault-manager.js list

# Create new vault
VAULT_MASTER_PASSWORD="..." node vault-manager.js create development

# Extract secrets
VAULT_MASTER_PASSWORD="..." node vault-manager.js extract development

# Verify vault integrity
./team-share.sh verify development

# Run security drill
./emergency-response.sh password-breach high --drill

# Package for team distribution
./team-share.sh package development
```

## Environment Variables

- `VAULT_MASTER_PASSWORD`: Master password for vault operations
- `EMERGENCY_DRILL`: Set to "true" for drill mode
- `SLACK_WEBHOOK_URL`: Slack notifications for emergencies
- `EMAIL_NOTIFICATION_LIST`: Email alerts for incidents

## Security Features

- **AES-256-CTR encryption** with PBKDF2 key derivation
- **HMAC-SHA256 authentication** for integrity verification
- **Secure file permissions** (600 for files, 700 for directories)
- **Audit logging** for all operations
- **Emergency response** procedures and notifications

## For More Information

See the complete documentation: [SECRETS_MANAGEMENT.md](../../SECRETS_MANAGEMENT.md)