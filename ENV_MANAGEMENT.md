# Environment Management Strategy - MS Elevate LEAPS Tracker

## Overview

The MS Elevate LEAPS Tracker monorepo implements a **three-layer environment management strategy** that provides flexibility, security, and maintainability across different deployment environments.

## Three-Layer Architecture

### Layer 1: Repository Defaults (`.env.defaults`)

- **Location**: `/.env.defaults`
- **Purpose**: Safe default values that can be committed to version control
- **Contents**: Non-sensitive configuration values, placeholders, and development defaults
- **Git Status**: **COMMITTED** ✅

**What goes here:**

- Default application settings (rate limits, timeouts, debug flags)
- Email template configurations
- Development seed data
- Placeholder values for required environment variables
- Safe defaults for optional services

### Layer 2: Environment Specific (`.env.{environment}`)

- **Files**: `/.env.development`, `/.env.staging`, `/.env.production`
- **Purpose**: Environment-specific configuration overrides
- **Contents**: Environment-appropriate values (URLs, service endpoints, feature flags)
- **Git Status**: **COMMITTED** ✅

**What goes here:**

- Environment-specific URLs and endpoints
- Feature flags per environment
- Environment-appropriate settings (debug levels, rate limits)
- Non-sensitive service configurations
- Template configurations for deployment

### Layer 3: Local Overrides (`.env.local` and variants)

- **Files**: `/.env.local`, `/.env.development.local`, `/.env.staging.local`, etc.
- **Purpose**: Local development overrides and sensitive values
- **Contents**: Personal development settings and secrets
- **Git Status**: **GITIGNORED** 🚫

**What goes here:**

- Sensitive API keys and secrets
- Personal development database connections
- Local service endpoints (localhost URLs)
- Developer-specific configuration
- Production secrets (set via deployment platform)

## File Precedence (Highest to Lowest)

1. **`.env.local`** - Highest priority (local overrides)
2. **`.env.{NODE_ENV}.local`** - Environment-specific local overrides
3. **`.env.{NODE_ENV}`** - Environment-specific defaults
4. **`.env.defaults`** - Repository defaults (lowest priority)

## Current Configuration

### Development Environment

The development environment uses **real working values** that have been migrated from the existing `.env.local` files:

```bash
# Example development values (already configured)
DATABASE_URL=postgresql://postgres.gsvhfcjmjnocxxosjloi:ElevateIndo2025!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aW4tcmVkYmlyZC02Mi5jbGVyay5hY2NvdW50cy5kZXYk
NEXT_PUBLIC_SUPABASE_URL=https://gsvhfcjmjnocxxosjloi.supabase.co
```

### Staging Environment

Staging uses placeholder values that should be replaced with actual staging credentials:

```bash
# Staging placeholders (replace in Vercel environment)
DATABASE_URL=postgresql://staging-user:staging-password@staging-host:5432/elevate_leaps_staging
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_staging_placeholder
```

### Production Environment

Production uses placeholder values that **must be set in the Vercel deployment environment**:

```bash
# Production placeholders (MUST be set in Vercel)
DATABASE_URL=postgresql://production_placeholder
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_production_placeholder
```

## Migration Guide

### What Was Moved Where

| Original Location      | New Location        | Status              |
| ---------------------- | ------------------- | ------------------- |
| `/.env.local`          | `/.env.development` | ✅ Values preserved |
| `/apps/web/.env.local` | `/.env.development` | ✅ Values preserved |
| `/packages/db/.env`    | `/.env.development` | ✅ Values preserved |

### Backup Files

All original environment files have been backed up to `/env-backup/`:

- `env-backup/root.env.local.backup`
- `env-backup/web.env.local.backup`
- `env-backup/db.env.backup`

## Usage Guide

### For Local Development

1. The monorepo should work immediately with the new structure
2. All existing values are preserved in `.env.development`
3. Create `.env.local` only if you need personal overrides

### For New Developers

1. Clone the repository
2. The `.env.defaults` and `.env.development` provide working defaults
3. Copy values to `.env.local` if personal customization is needed:
   ```bash
   cp .env.development .env.local
   # Edit .env.local with your personal settings
   ```

### For Deployment

1. **Staging**: Set actual staging values in Vercel environment variables
2. **Production**: Set actual production values in Vercel environment variables
3. The environment-specific files provide templates for required variables

## Team Collaboration

### Adding New Environment Variables

1. **Add to `.env.defaults`** with a safe default or placeholder
2. **Add to environment-specific files** as needed
3. **Update `turbo.json` globalEnv** if the variable affects builds
4. **Document** the new variable in this file

### Updating Sensitive Values

1. **Never commit sensitive values** to any tracked file
2. **Update deployment environments** (Vercel, etc.) with real values
3. **Share sensitive development values** through secure channels
4. **Use `.env.local`** for personal development overrides

### Environment-Specific Changes

1. **Development**: Edit `.env.development` and commit changes
2. **Staging**: Edit `.env.staging` template and update Vercel environment
3. **Production**: Edit `.env.production` template and update Vercel environment

## Variable Reference

### Required Variables (Must be set in all environments)

| Variable                            | Purpose                | Layer                |
| ----------------------------------- | ---------------------- | -------------------- |
| `DATABASE_URL`                      | PostgreSQL connection  | Environment-specific |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication   | Environment-specific |
| `CLERK_SECRET_KEY`                  | Clerk server-side key  | Local/Deployment     |
| `NEXT_PUBLIC_SUPABASE_URL`          | Supabase project URL   | Environment-specific |
| `SUPABASE_SERVICE_ROLE_KEY`         | Supabase admin key     | Local/Deployment     |
| `NEXT_PUBLIC_SITE_URL`              | Application public URL | Environment-specific |

### Integration Variables

| Variable                | Purpose            | Required For |
| ----------------------- | ------------------ | ------------ |
| `KAJABI_WEBHOOK_SECRET` | Webhook validation | Production   |
| `KAJABI_API_KEY`        | Kajabi API access  | Production   |
| `KAJABI_CLIENT_SECRET`  | Kajabi OAuth       | Production   |
| `RESEND_API_KEY`        | Email service      | Optional     |
| `OPENAI_API_KEY`        | AI features        | Optional     |

### Application Settings

| Variable                 | Default | Purpose               |
| ------------------------ | ------- | --------------------- |
| `RATE_LIMIT_RPM`         | 60      | API rate limiting     |
| `WEBHOOK_RATE_LIMIT_RPM` | 120     | Webhook rate limiting |
| `DEBUG`                  | false   | Debug logging         |
| `DATABASE_POOL_MAX`      | 10      | Connection pool size  |

## Security Best Practices

1. **Never commit secrets** - Use `.env.local` or deployment environment variables
2. **Use placeholders** - Environment files should contain safe placeholder values
3. **Rotate credentials regularly** - Update API keys and secrets periodically
4. **Audit access** - Review who has access to production environment variables
5. **Use principle of least privilege** - Only grant necessary permissions

## Environment Validation System

### Comprehensive Validation

The monorepo includes a comprehensive environment validation system that ensures all required variables are present, properly formatted, and valid for the target environment.

#### Validation Script

Run the validation script to check your environment:

```bash
# Validate current environment
pnpm run env:validate

# Validate specific environment
pnpm run env:validate:prod
pnpm run env:validate:staging

# CI/CD validation (strict mode)
pnpm run env:validate:ci

# JSON output for scripts
pnpm run env:validate:json
```

#### Validation Features

- **Format Validation**: Checks URL formats, API key patterns, JWT tokens, email addresses
- **Environment-Specific Rules**: Different validation rules for development, staging, and production
- **Placeholder Detection**: Identifies and flags placeholder values that need replacement
- **Integration Validation**: Verifies optional service configurations
- **CI/CD Support**: Strict validation for automated deployments

#### Validation Categories

1. **Critical Variables**: Must be present and valid in all environments

   - Database connections
   - Authentication keys
   - Storage configuration
   - Site URLs

2. **Integration Variables**: Required in production, optional in development

   - Kajabi webhook secrets
   - Email service keys
   - AI service tokens
   - Error tracking DSNs

3. **Application Configuration**: Settings with safe defaults

   - Rate limits
   - Debug flags
   - Pool sizes
   - Email templates

4. **Optional Services**: Development and operational tools
   - Turbo cache tokens
   - Analytics keys
   - Cron secrets

### Runtime Validation

The application includes runtime validation helpers for type-safe environment access:

```typescript
import {
  initializeEnvironment,
  getDatabaseConfig,
  getAuthConfig,
  validateCriticalEnvironment,
} from '@elevate/utils/env'

// Early validation during app startup
initializeEnvironment({
  skipOptional: false,
  throwOnError: true,
  logger: console.log,
})

// Type-safe configuration objects
const dbConfig = getDatabaseConfig()
const authConfig = getAuthConfig()
```

#### Error Types

- **MissingEnvironmentVariableError**: Required variable not set
- **InvalidEnvironmentVariableError**: Variable format is invalid
- **IncompleteEnvironmentError**: Multiple validation failures

### TypeScript Support

Environment variables are fully typed with JSDoc documentation:

```typescript
// Auto-complete and type safety for all environment variables
process.env.DATABASE_URL // string
process.env.RATE_LIMIT_RPM // string | undefined
process.env.DEBUG // 'true' | 'false' | undefined
```

### Build Integration

Environment validation is integrated into the build process:

- **Pre-build validation**: Runs before any build starts
- **CI/CD checks**: Strict validation in automated pipelines
- **Development validation**: Warnings for missing optional variables
- **Production validation**: Errors for any missing required variables

## Runtime Validation Examples

### Using Validation Helpers in Applications

The runtime validation system provides type-safe environment access with early error detection:

```typescript
import {
  initializeEnvironment,
  getDatabaseConfig,
  getAuthConfig,
  getStorageConfig,
  getAppConfig,
  validateCriticalEnvironment,
  EnvironmentError,
} from '@elevate/utils/env'

// Early validation during app startup (recommended in _app.tsx or layout.tsx)
try {
  initializeEnvironment({
    skipOptional: false, // Validate optional integrations
    throwOnError: true, // Throw errors for missing critical vars
    logger: console.log, // Custom logger function
  })
} catch (error) {
  if (error instanceof EnvironmentError) {
    console.error(`Environment setup failed: ${error.message}`)
    // Handle gracefully or exit
  }
}

// Type-safe configuration objects with validation
const dbConfig = getDatabaseConfig() // Validates DB_URL, DIRECT_URL, etc.
const authConfig = getAuthConfig() // Validates Clerk keys
const storageConfig = getStorageConfig() // Validates Supabase configuration
const appConfig = getAppConfig() // General app settings
```

### API Route Validation

Add validation to API routes to ensure proper configuration:

```typescript
// pages/api/webhooks/kajabi.ts or app/api/webhooks/kajabi/route.ts
import { getRequiredEnv, validateKajabiConfig } from '@elevate/utils/env'

export async function POST(request: Request) {
  try {
    // Validate Kajabi configuration before processing
    validateKajabiConfig()

    const webhookSecret = getRequiredEnv('KAJABI_WEBHOOK_SECRET')
    // ... handle webhook
  } catch (error) {
    if (error instanceof EnvironmentError) {
      return new Response('Configuration error', { status: 500 })
    }
  }
}
```

### Server Component Validation

For Next.js Server Components, validate environment early:

```typescript
// app/dashboard/page.tsx
import { getAppConfig, getStorageConfig } from '@elevate/utils/env'

export default async function DashboardPage() {
  // Validate configuration at component level
  const appConfig = getAppConfig()
  const storageConfig = getStorageConfig()

  // Safe to use configuration
  return (
    <div>
      <h1>Dashboard for {appConfig.siteUrl}</h1>
      {/* Component content */}
    </div>
  )
}
```

### Development Environment Checks

Add development-specific validation and warnings:

```typescript
// lib/dev-setup.ts
import { isDevelopment, validateOptionalIntegrations } from '@elevate/utils/env'

if (isDevelopment()) {
  const { configured, errors } = validateOptionalIntegrations()

  console.log('🔧 Development Environment Setup:')
  console.log(`   Configured services: ${configured.join(', ') || 'None'}`)

  if (errors.length > 0) {
    console.warn('⚠️  Optional service warnings:')
    errors.forEach((error) => console.warn(`   ${error}`))
  }
}
```

### Custom Validation Rules

Create custom validators for your specific needs:

```typescript
import {
  getRequiredEnv,
  InvalidEnvironmentVariableError,
} from '@elevate/utils/env'

// Custom validator for specific format requirements
function validateCustomApiKey(apiKey: string): boolean {
  return /^custom_[A-Za-z0-9]{32}$/.test(apiKey)
}

// Usage with custom validation
try {
  const customApiKey = getRequiredEnv('CUSTOM_API_KEY')

  if (!validateCustomApiKey(customApiKey)) {
    throw new InvalidEnvironmentVariableError(
      'CUSTOM_API_KEY',
      'format: custom_[32 alphanumeric characters]',
    )
  }

  // Safe to use customApiKey
} catch (error) {
  console.error('Custom API key validation failed:', error.message)
}
```

### Error Handling Patterns

Recommended error handling patterns for different scenarios:

```typescript
import {
  EnvironmentError,
  MissingEnvironmentVariableError,
  InvalidEnvironmentVariableError,
  IncompleteEnvironmentError,
} from '@elevate/utils/env'

// Graceful degradation pattern
function getOptionalFeatureConfig() {
  try {
    validateKajabiConfig()
    return { kajabiEnabled: true }
  } catch (error) {
    if (error instanceof EnvironmentError) {
      console.warn('Kajabi integration disabled:', error.message)
      return { kajabiEnabled: false }
    }
    throw error // Re-throw unexpected errors
  }
}

// Early exit pattern for critical features
function requireDatabaseConnection() {
  try {
    return getDatabaseConfig()
  } catch (error) {
    if (error instanceof EnvironmentError) {
      console.error(
        'Database configuration required but missing:',
        error.message,
      )
      process.exit(1) // Exit early in server context
    }
    throw error
  }
}

// Detailed error reporting for debugging
function debugEnvironmentIssues() {
  try {
    validateCriticalEnvironment()
  } catch (error) {
    if (error instanceof IncompleteEnvironmentError) {
      console.error('Multiple environment issues found:')
      error.message.split('\n').forEach((line) => {
        if (line.trim()) console.error(`  - ${line.trim()}`)
      })
    } else if (error instanceof EnvironmentError) {
      console.error(`Environment error: ${error.message}`)
      console.error(`Error code: ${error.code}`)
      if (error.variable) {
        console.error(`Variable: ${error.variable}`)
      }
    }
  }
}
```

## Troubleshooting

### Environment Validation Failures

Use the validation system to diagnose issues:

```bash
# Get detailed validation report with colored output
pnpm run env:validate

# Validate specific environment
pnpm run env:validate:prod
pnpm run env:validate:staging

# CI/CD validation (strict mode)
pnpm run env:validate:ci

# JSON output for programmatic processing
pnpm run env:validate:json
pnpm run env:validate:prod --json | jq '.errors'
pnpm run env:validate:json | jq '.summary'
```

#### Common Validation Error Types

**1. Placeholder Values**: Variables contain placeholder text

```bash
# Error message:
❌ Variable KAJABI_WEBHOOK_SECRET contains placeholder value: your-kajabi-webhook-secret

# Fix: Replace placeholder with actual value
KAJABI_WEBHOOK_SECRET=whsec_actual_webhook_secret_from_kajabi
```

**2. Invalid Formats**: URLs, keys, or tokens have wrong format

```bash
# Error message:
❌ Invalid format for NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: expected Clerk publishable key

# Fix: Verify format matches expected pattern
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_abcd1234efgh5678ijkl9012mnop3456
```

**3. Environment Mismatches**: Test keys in production environment

```bash
# Error message:
❌ Variable CLERK_KEYS: expected live keys in production environment

# Fix: Use live keys for production
CLERK_SECRET_KEY=sk_live_productionkey123...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_productionkey123...
```

**4. Missing Required Variables**: Critical variables not set

```bash
# Error message:
❌ Missing required variable: DATABASE_URL

# Fix: Set the missing variable
DATABASE_URL=postgresql://user:password@host:5432/database
```

**5. URL Format Issues**: Invalid URL structure

```bash
# Error message:
❌ Invalid URL format for NEXT_PUBLIC_SITE_URL: https://localhost

# Fix: Use proper URL format
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org
```

**6. JWT Token Issues**: Invalid Supabase key format

```bash
# Error message:
❌ Invalid format for SUPABASE_SERVICE_ROLE_KEY: expected valid JWT

# Fix: Use proper JWT format from Supabase dashboard
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Validation Report Interpretation

When running `pnpm run env:validate --json`, the output includes:

```json
{
  "environment": "development",
  "timestamp": "2025-09-04T21:30:00.000Z",
  "status": "valid" | "invalid",
  "summary": {
    "errors": 2,
    "warnings": 1,
    "totalVariables": 45
  },
  "errors": [
    {
      "message": "Missing required variable: KAJABI_WEBHOOK_SECRET",
      "code": "MISSING_REQUIRED_VAR",
      "category": "error"
    }
  ],
  "warnings": [
    {
      "message": "RESEND_API_KEY: placeholder value detected",
      "code": "PLACEHOLDER_VALUE",
      "category": "warning"
    }
  ]
}
```

Use this for automated checking:

```bash
# Check if validation passes
if pnpm run env:validate:ci --silent; then
  echo "✅ Environment validation passed"
else
  echo "❌ Environment validation failed"
  exit 1
fi

# Get error count programmatically
ERROR_COUNT=$(pnpm run env:validate:json | jq '.summary.errors')
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "Found $ERROR_COUNT environment errors"
fi
```

### Environment Variables Not Loading

**Symptoms**: Variables not available in `process.env` or validation reports missing variables

**Diagnosis**:

```bash
# Check which files exist and their contents
ls -la .env*
pnpm run env:validate --json | jq '.errors'

# Verify file precedence is working
node -e "console.log('NODE_ENV:', process.env.NODE_ENV); console.log('Sample var:', process.env.DATABASE_URL?.substring(0, 20) + '...')"
```

**Solutions**:

1. **File Naming**: Use exact names (`.env.development` not `.env.dev`)
2. **Location**: Files must be in repository root, not app subdirectories
3. **Restart**: Restart development server after env file changes
4. **Syntax**: Check for missing quotes, extra spaces, or invalid characters
5. **Turbo Cache**: If variable affects builds, add to `turbo.json` globalEnv

**Example Debug Session**:

```bash
# Step 1: Verify files exist
ls -la .env*
# Expected: .env.defaults .env.development .env.staging .env.production

# Step 2: Check file contents (non-sensitive vars only)
grep NEXT_PUBLIC_ .env.development
grep NODE_ENV .env.development

# Step 3: Test loading
node -e "require('dotenv').config({ path: '.env.development' }); console.log(Object.keys(process.env).filter(k => k.includes('CLERK')));"

# Step 4: Run validation
pnpm run env:validate
```

### Missing Variables in Deployment

**Symptoms**: App works locally but fails in staging/production with "missing variable" errors

**Diagnosis**:

```bash
# Check deployment requirements
pnpm run env:validate:prod
pnpm run env:validate:staging

# Compare local vs deployment requirements
pnpm run env:validate:json | jq '.errors[] | select(.code == "MISSING_REQUIRED_VAR")'
```

**Solutions**:

1. **Set in Platform**: Add variables to Vercel/deployment platform environment
2. **Replace Placeholders**: Update placeholder values in `.env.production`
3. **Check Sensitive Variables**: Ensure secrets aren't committed to git
4. **Environment Templates**: Verify `.env.{environment}` files have correct values
5. **Build-time vs Runtime**: Understand which variables are needed when

**Vercel Environment Setup**:

```bash
# Using Vercel CLI
vercel env add KAJABI_WEBHOOK_SECRET
vercel env add CLERK_SECRET_KEY

# Or set via dashboard at vercel.com/[team]/[project]/settings/environment-variables
```

### Database Connection Issues

**Symptoms**: Database connection errors, timeouts, or authentication failures

**Diagnosis**:

```bash
# Validate database configuration
pnpm run env:validate | grep -i database

# Test connection format
node -e "
const url = process.env.DATABASE_URL;
console.log('URL format check:');
console.log('- Length:', url?.length);
console.log('- Starts with postgresql:', url?.startsWith('postgresql://'));
console.log('- Has @:', url?.includes('@'));
console.log('- Has port:', /:\d+\//.test(url || ''));
"

# Test actual connection (if safe to do so)
npx prisma db execute --preview-feature --command "SELECT version();" --schema packages/db/schema.prisma
```

**Solutions**:

1. **Format Validation**: Run `pnpm run env:validate` to check URL format
2. **Connection String**: Verify `DATABASE_URL` and `DIRECT_URL` are valid PostgreSQL URLs
3. **Network Access**: Ensure database allows connections from your environment
4. **Pool Settings**: Check connection pool settings in validation output
5. **SSL Requirements**: Add `?sslmode=require` if needed for production databases

**Connection String Format**:

```bash
# Correct format:
postgresql://username:password@host:port/database?sslmode=require

# Common issues:
postgresql://user:pass with spaces@host:5432/db  # ❌ Spaces in password
postgresql://user@host:5432/db                   # ❌ Missing password
postgresql://user:pass@host/db                   # ❌ Missing port
```

### Authentication Problems

**Symptoms**: Login failures, webhook validation errors, or key format issues

**Diagnosis**:

```bash
# Validate auth configuration
pnpm run env:validate | grep -i clerk

# Check key consistency
node -e "
const pub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const secret = process.env.CLERK_SECRET_KEY;
console.log('Publishable key env:', pub?.includes('test') ? 'test' : 'live');
console.log('Secret key env:', secret?.includes('test') ? 'test' : 'live');
console.log('Keys match env:', (pub?.includes('test') === secret?.includes('test')));
"
```

**Solutions**:

1. **Format Validation**: Use validation to verify Clerk key formats
2. **Environment Matching**: Ensure test/live keys match environment
3. **Webhook Secrets**: Check webhook secrets are correctly formatted
4. **Public Keys**: Ensure public keys are accessible to browser (NEXT*PUBLIC*)
5. **OAuth URLs**: Verify redirect URLs match your environment

**Key Format Reference**:

```bash
# Clerk key formats:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_[24+ chars] or pk_live_[24+ chars]
CLERK_SECRET_KEY=sk_test_[24+ chars] or sk_live_[24+ chars]
CLERK_WEBHOOK_SECRET=whsec_[24+ chars]

# Environment consistency:
# ✅ Both test: pk_test_... + sk_test_...
# ✅ Both live: pk_live_... + sk_live_...
# ❌ Mixed: pk_test_... + sk_live_...
```

### Runtime Validation Issues

**Symptoms**: Application crashes on startup with environment errors

**Diagnosis**:

```typescript
// Add to your app startup (e.g., _app.tsx or layout.tsx)
import { initializeEnvironment } from '@elevate/utils/env'

try {
  initializeEnvironment({
    throwOnError: false, // Don't crash, just log
    logger: console.log, // See detailed output
  })
} catch (error) {
  console.error('Environment validation failed:', error)
}
```

**Solutions**:

1. **Early Validation**: Call `initializeEnvironment()` early in app startup
2. **Graceful Degradation**: Set `throwOnError: false` for non-critical features
3. **Feature Flags**: Use validation results to enable/disable features
4. **Development Warnings**: Show warnings for missing optional services
5. **Production Strictness**: Fail fast on missing critical variables in production

### Build-Time vs Runtime Variables

**Understanding the difference**:

```bash
# Build-time variables (NEXT_PUBLIC_*):
# - Available in browser
# - Bundled into client code
# - Must be set during build
# - Safe to be public

# Runtime variables (no prefix):
# - Only available on server
# - Not bundled into client
# - Can change without rebuild
# - Should be kept secret
```

**Troubleshooting build vs runtime issues**:

```typescript
// Build-time access (client + server):
const publicUrl = process.env.NEXT_PUBLIC_SITE_URL // ✅ Always works

// Runtime-only access (server only):
const secretKey = process.env.CLERK_SECRET_KEY // ✅ Server, ❌ Client

// Check where code runs:
if (typeof window === 'undefined') {
  // Server-side: can access all variables
  console.log('Secret key available:', !!process.env.CLERK_SECRET_KEY)
} else {
  // Client-side: only NEXT_PUBLIC_ variables
  console.log('Public URL:', process.env.NEXT_PUBLIC_SITE_URL)
}
```

## Monitoring and Maintenance

### Regular Tasks

- [ ] Review and rotate API keys quarterly
- [ ] Audit environment variable usage monthly
- [ ] Run environment validation in all environments monthly
- [ ] Update placeholder values when adding new environments
- [ ] Sync development team on environment changes
- [ ] Verify validation rules match current integrations

### When Adding New Services

1. Add placeholder to `.env.defaults`
2. Add real values to environment-specific files as appropriate
3. Update validation rules in `scripts/validate-env.js`
4. Add TypeScript types in `packages/types/src/env.d.ts`
5. Update runtime validators in `packages/utils/src/env.ts` if needed
6. Update deployment environments with production values
7. Document the new service in this file
8. Add to `turbo.json` globalEnv if affects builds

### When Deprecating Services

1. Remove from all environment files
2. Remove from validation rules in `scripts/validate-env.js`
3. Remove from TypeScript types in `packages/types/src/env.d.ts`
4. Remove from runtime validators in `packages/utils/src/env.ts`
5. Remove from `turbo.json` globalEnv
6. Clean up deployment environment variables
7. Update documentation

## Migration History

### 2025-01-XX - Initial Three-Layer Implementation

- ✅ Created `.env.defaults` with safe repository defaults
- ✅ Migrated existing values to `.env.development`
- ✅ Created staging and production templates
- ✅ Updated `.gitignore` for new structure
- ✅ Enhanced `turbo.json` globalEnv configuration
- ✅ Preserved all existing working values
- ✅ Created comprehensive documentation

### 2025-09-04 - Comprehensive Environment Validation System

- ✅ Created comprehensive validation script (`scripts/validate-env.js`)
- ✅ Added TypeScript environment types (`packages/types/src/env.d.ts`)
- ✅ Built runtime validation helpers (`packages/utils/src/env.ts`)
- ✅ Integrated validation into build and CI/CD processes
- ✅ Added format validation for URLs, API keys, JWTs, and email addresses
- ✅ Implemented environment-specific validation rules
- ✅ Created placeholder detection and warnings
- ✅ Added CLI interface with JSON output support
- ✅ Enhanced CI/CD workflow with environment validation checks
- ✅ Created comprehensive troubleshooting documentation with examples
- ✅ Added runtime validation examples and error handling patterns
- ✅ Implemented early validation helpers for application startup
- ✅ Created type-safe configuration objects with validation
- ✅ Added detailed diagnostic commands and debugging workflows

### Preserved Values

All existing environment variables were preserved during migration:

- Database connections (working Supabase configuration)
- Authentication keys (working Clerk configuration)
- Integration secrets (Kajabi, Resend)
- Application settings (URLs, debug flags)
- Development seed data

## Support

For questions about environment configuration:

1. Check this documentation first
2. Review the backup files in `/env-backup/` for original values
3. Consult the team lead for sensitive production values
4. Refer to service documentation (Clerk, Supabase, etc.) for setup guides

---

**Last Updated**: 2025-09-04  
**Next Review**: Quarterly environment audit  
**Environment Validation System**: Complete and integrated

## Root-only DB Env & Prisma Sync (Enforcement)

- `scripts/env/enforce-root-env.mjs`: strips `DATABASE_URL` and `DIRECT_URL` from any `apps/*/.env*` files to prevent drift. Backs up originals with `.bak` in place.
- `scripts/env/sync-db-env-to-prisma.mjs`: writes effective root DB URLs into `packages/db/.env` so Prisma CLI uses the same connection as the app.
- `scripts/env/exec-dev-with-root-env.mjs`: loads root env in precedence order before spawning dev servers, ensuring consistent environment across processes.

## Commands (consolidated)

- `pnpm dev` – runs root env enforcement/sync and starts web/admin with the root env.
- `pnpm db:push` – syncs DB env to Prisma then pushes schema.
- `pnpm db:seed` – syncs DB env to Prisma then seeds the DB.

## Routing, i18n, and Middleware (Web)

- i18n uses `next-intl` with locale prefix normalization. URLs are locale-prefixed (e.g., `/en/...`).
- Public API routes are whitelisted in middleware: `/api/leaderboard`, `/api/stats`, `/api/stories`.
- Clerk integration in middleware:
  - For non-public API routes: `await auth()` is checked; returns 401 if unauthenticated.
  - For non-public page routes: `redirectToSignIn()` is used when session is missing.
  - We intentionally avoid using unsupported helpers like `auth().protect()` to keep behavior explicit and compatible.

## Production Guidance (recap)

- Source production variables from Vault/platform; do not commit secrets.
- Keep DB URLs only at the root scope and inject at deploy time.
- Ensure Clerk keys match environment (test vs live).
