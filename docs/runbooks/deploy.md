---
title: Deployment Runbook
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [deployment, operations, runbook]
---

## Deployment Runbook

Step-by-step procedures for deploying the MS Elevate LEAPS Tracker to staging and production.

## Overview

The platform consists of two separate Next.js applications deployed to Vercel:

- **Web App**: Public site + participant dashboard (`elevate-web`)
- **Admin App**: Review console for admins (`elevate-admin`)

## Pre-Deployment Checklist

### Code Quality

```bash
# Run full validation suite
pnpm verify:all

# Check build artifacts
pnpm build:verify

# Run tests
pnpm test

# Check bundle sizes
pnpm analyze:bundles
```

### Database

```bash
# Check for schema drift
pnpm db:check-drift

# Verify migrations are ready
pnpm db:migrate:prod --dry-run

# Backup production database (if needed)
# See database runbook for backup procedures
```

### Environment Variables

```bash
# Verify all required env vars are set
pnpm run env:validate:ci

# Check Vercel environment variables
vercel env ls --scope production
```

## Deployment Procedures

### Staging Deployment

Staging deployments happen automatically on PR creation via Vercel preview deployments.

**Manual staging deployment:**

```bash
# Deploy web app to staging
cd apps/web
vercel --target preview

# Deploy admin app to staging
cd apps/admin
vercel --target preview
```

**Verification:**

1. Check deployment URLs in Vercel dashboard
2. Verify authentication works (Google OAuth)
3. Test database connectivity
4. Check file uploads to Supabase Storage
5. Verify Kajabi webhook endpoint responds

### Production Deployment

Production deployments happen automatically on merge to `main` branch.

**Manual production deployment:**

```bash
# Deploy web app to production
cd apps/web
vercel --prod

# Deploy admin app to production
cd apps/admin
vercel --prod
```

**Post-deployment verification:**

1. **Health Checks**:

   ```bash
   # Web app health (should return JSON with status: "healthy")
   curl -f https://leaps.mereka.org/api/health

   # Admin app health (no dedicated health endpoint; use CSP report as proxy)
   curl -f https://admin.leaps.mereka.org/api/csp-report -X POST -H "Content-Type: application/json" -d '{}'

   # Expected response format:
   # {"success": true, "data": {"status": "healthy", "timestamp": "...", "database": "connected"}}
   ```

2. **Authentication Test**:

   - Visit both apps
   - Test Google OAuth login
   - Verify role-based access

3. **Database Connectivity**:

   - Check dashboard loads user data
   - Verify submissions can be created
   - Test admin approval workflow

4. **File Uploads**:

   - Upload test evidence file
   - Verify file appears in Supabase Storage
   - Check signed URL generation

5. **Integrations**:

   ```bash
   # Test Kajabi webhook (POST to /api/kajabi/webhook)
   curl -X POST https://leaps.mereka.org/api/kajabi/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'

   # Check cron endpoints (admin access required)
   curl https://leaps.mereka.org/api/cron/refresh-leaderboards
   curl https://leaps.mereka.org/api/cron/enforce-retention
   ```

   - Verify email notifications work (check `/api/emails/*` routes)
   - Check leaderboard updates via `/api/leaderboard`

## Database Migrations

### Development

```bash
# Create migration
pnpm db:migrate

# Apply to development database
pnpm db:push
```

### Production

```bash
# Deploy migrations to production
pnpm db:migrate:prod

# Verify migration success
pnpm db:check-drift
```

**Migration Safety:**

- Always test migrations on staging first
- Backup production database before major schema changes
- Use additive migrations when possible (add columns, don't drop)
- Coordinate with team for breaking changes

## Environment Management

### Required Environment Variables

**Web App:**

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE=...
KAJABI_WEBHOOK_SECRET=...
RESEND_API_KEY=...
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org
```

**Admin App:**

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE=...
NEXT_PUBLIC_SITE_URL=https://admin.leaps.mereka.org
```

### Setting Environment Variables

**Via Vercel CLI:**

```bash
# Set for production
vercel env add VARIABLE_NAME production

# Set for preview (staging)
vercel env add VARIABLE_NAME preview
```

**Via Vercel Dashboard:**

1. Go to project settings
2. Navigate to Environment Variables
3. Add/edit variables for appropriate environments

## Monitoring & Alerts

### Health Monitoring

Both apps expose health check endpoints:

- Web: `https://leaps.mereka.org/api/health`
- Admin: `https://admin.leaps.mereka.org/api/health`

**Expected Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-09-10T12:00:00Z",
  "database": "connected",
  "storage": "connected"
}
```

### Error Monitoring

- **Sentry**: Automatic error reporting and alerting
- **Vercel Analytics**: Performance and usage metrics
- **Supabase Dashboard**: Database performance and errors

### Key Metrics to Monitor

- **Response Times**: API endpoints < 500ms
- **Error Rates**: < 1% error rate
- **Database Connections**: Monitor connection pool usage
- **File Upload Success**: > 95% success rate
- **Authentication Success**: > 99% success rate

## Rollback Procedures

### Application Rollback

**Via Vercel Dashboard:**

1. Go to project deployments
2. Find previous stable deployment
3. Click "Promote to Production"

**Via Vercel CLI:**

```bash
# List recent deployments
vercel ls

# Rollback to specific deployment
vercel promote <deployment-url> --scope production
```

### Database Rollback

**Schema Rollback:**

```bash
# Revert to previous migration
pnpm db:migrate:reset --to <migration-name>
```

**Data Rollback:**

- Restore from database backup
- See database procedures in [DATABASE.md](../DATABASE.md)

## Common Issues

### Deployment Failures

**Build Failures:**

```bash
# Check build logs in Vercel dashboard
# Common fixes:
pnpm build:clean          # Clean build
pnpm verify:exports       # Check exports alignment
pnpm typecheck           # Fix TypeScript errors
```

**Environment Variable Issues:**

```bash
# Verify all required vars are set
vercel env ls --scope production

# Check env validation
pnpm run env:validate:ci
```

### Runtime Issues

**Database Connection Errors:**

- Check DATABASE_URL is correct
- Verify Supabase instance is running
- Check connection pool limits

**Authentication Issues:**

- Verify Clerk keys are correct
- Check OAuth redirect URLs
- Ensure NEXT_PUBLIC_SITE_URL matches domain

**File Upload Failures:**

- Check Supabase Storage configuration
- Verify SUPABASE_SERVICE_ROLE key
- Check file size limits and CORS settings

## Emergency Procedures

### Critical Issue Response

1. **Assess Impact**: Determine if issue affects all users or subset
2. **Immediate Action**: Consider rolling back if severe
3. **Communication**: Update status page and notify stakeholders
4. **Investigation**: Gather logs and error details
5. **Fix**: Apply hotfix or schedule maintenance window
6. **Post-mortem**: Document incident and prevention measures

### Contact Information

- **Platform Team**: [team-email]
- **On-call Engineer**: [on-call-contact]
- **Vercel Support**: [support-contact]
- **Supabase Support**: [support-contact]

### Escalation Path

1. **Level 1**: Platform team member
2. **Level 2**: Platform team lead
3. **Level 3**: Engineering manager
4. **Level 4**: External vendor support

---

_This runbook should be updated after each deployment to reflect current procedures and lessons learned._
