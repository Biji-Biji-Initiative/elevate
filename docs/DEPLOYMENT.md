---
title: Deployment Guide
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [deployment, vercel, operations]
---

# Deployment Guide - MS Elevate LEAPS Tracker

This guide covers setting up separate Vercel deployments for the Web App and Admin App, including configuration, environment variables, and deployment processes.

## Overview

The MS Elevate LEAPS Tracker consists of two separate Next.js applications:

- **Web App** (`apps/web`): Public site and participant dashboard
- **Admin App** (`apps/admin`): Reviewer and administrator console

Each app is deployed as a separate Vercel project to enable independent scaling, configuration, and domain management.

## Prerequisites

1. **Vercel CLI**: Install globally with `npm i -g vercel`
2. **Vercel Account**: Access to organization with appropriate permissions
3. **GitHub Repository**: Connected to Vercel with proper webhooks
4. **Database Access**: Supabase PostgreSQL instance configured
5. **External Services**: Clerk auth, Kajabi integration, email service

## Vercel Project Setup

### Step 1: Create Separate Vercel Projects

#### Web App Project

1. In Vercel dashboard, click "Add New Project"
2. Import from GitHub repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: Leave empty (uses monorepo root)
   - **Build Command**: `pnpm turbo run build --filter=web`
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `pnpm install --frozen-lockfile && pnpm db:generate`

#### Admin App Project

1. Create another new project in Vercel
2. Import the same GitHub repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/admin`
   - **Build Command**: `cd ../.. && pnpm turbo run build --filter=elevate-admin`
   - **Output Directory**: `.next`
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile && pnpm db:generate`

### Step 2: Configure Domains

#### Production Domains

- **Web App**: `leaps.mereka.org`
- **Admin App**: `admin.leaps.mereka.org`

#### Staging Domains

- **Web App**: Vercel-generated preview URLs
- **Admin App**: Vercel-generated preview URLs

### Step 3: Environment Variables

Each Vercel project needs its own set of environment variables.

#### Web App Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
CLERK_WEBHOOK_SECRET=<your-clerk-webhook-secret>

# Email Service (Resend)
RESEND_API_KEY=<your-resend-api-key>
FROM_EMAIL=MS Elevate <noreply@leaps.mereka.org>
REPLY_TO_EMAIL=support@leaps.mereka.org

# Kajabi Integration
KAJABI_WEBHOOK_SECRET=<your-kajabi-webhook-secret>
KAJABI_API_KEY=<your-kajabi-api-key>
KAJABI_CLIENT_SECRET=<your-kajabi-client-secret>

# Application URLs
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org

# Production Secrets
CRON_SECRET=<your-cron-secret>

# Optional
OPENAI_API_KEY=<your-openai-api-key>

# Vercel
VERCEL_ENV=production
```

#### Admin App Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>

# Kajabi Integration
KAJABI_API_KEY=<your-kajabi-api-key>
KAJABI_CLIENT_SECRET=<your-kajabi-client-secret>

# Application URLs
NEXT_PUBLIC_SITE_URL=https://admin.leaps.mereka.org

# Optional
OPENAI_API_KEY=<your-openai-api-key>

# Vercel
VERCEL_ENV=production
```

### Step 4: GitHub Actions Integration

Update GitHub repository secrets with Vercel project information:

#### Required Secrets

```bash
# Vercel Authentication
VERCEL_TOKEN=<your-vercel-token>

# Web App Project
VERCEL_WEB_ORG_ID=<your-web-org-id>
VERCEL_WEB_PROJECT_ID=<your-web-project-id>

# Admin App Project
VERCEL_ADMIN_ORG_ID=<your-admin-org-id>
VERCEL_ADMIN_PROJECT_ID=<your-admin-project-id>

# Application URLs
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org

# Database and Services (shared)
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
# ... other shared secrets
```

#### Finding Vercel IDs

To get your Vercel organization and project IDs:

```bash
# List organizations
vercel teams ls

# List projects for an organization
vercel ls --scope=your-org-name

# Get project info
vercel project ls
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

The automated GitHub Actions workflow supports deploying both apps:

#### Deploy Both Apps to Production

```bash
# Triggered automatically on push to main branch
git push origin main
```

#### Deploy Specific App via Manual Trigger

1. Go to GitHub Actions tab
2. Select "Deploy" workflow
3. Click "Run workflow"
4. Choose:
   - **Environment**: `staging` or `production`
   - **Apps**: `web`, `admin`, or `both`

#### Deploy Both Apps to Staging

```bash
# Create staging branch and push
git checkout -b staging
git push origin staging
```

### Method 2: Manual Deployment Scripts

#### Deploy Web App Only

```bash
./scripts/deploy-web.sh production
```

#### Deploy Admin App Only

```bash
./scripts/deploy-admin.sh production
```

#### Deploy Both Apps

```bash
./scripts/deploy-all.sh production
```

### Method 3: Direct Vercel CLI

#### From Monorepo Root (Web App)

```bash
vercel --prod
```

#### From Admin Directory

```bash
cd apps/admin
vercel --prod
```

## Configuration Files

## Scheduled Jobs (Cron)

### Evidence Retention

Add a Vercel Cron job to enforce evidence retention regularly. The job calls the API with a secret.

1) Set `CRON_SECRET` as an Environment Variable in Vercel for the Web app.
2) Add a cron schedule (e.g., daily at 02:00 UTC) for:

```
GET https://<your-web-domain>/api/cron/enforce-retention?days=730&limit=200&offset=0
Authorization: Bearer ${CRON_SECRET}
```

Use `offset` to process in batches across multiple runs if needed.

### Internal SLO Summary

For non-public environments, enable the internal SLO endpoint:

- Set `ENABLE_INTERNAL_ENDPOINTS=1`
- Set `INTERNAL_METRICS_TOKEN=<random>`

Call:

```
GET https://<your-web-domain>/api/slo
Authorization: Bearer <INTERNAL_METRICS_TOKEN>
```

### Root `vercel.json` (Web App)

```json
{
  "buildCommand": "pnpm turbo run build --filter=web",
  "installCommand": "pnpm install --frozen-lockfile && pnpm db:generate",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "functions": {
    "apps/web/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### `apps/admin/vercel.json` (Admin App)

```json
{
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=elevate-admin",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile && pnpm db:generate",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

## Environment-Specific Configuration

### Production Environment

- **Web App**: `https://leaps.mereka.org`
- **Admin App**: `https://admin.leaps.mereka.org`
- **Database**: Production Supabase instance
- **Auth**: Clerk production environment
- **Integrations**: Live Kajabi webhooks

### Staging Environment

- **Web App**: Vercel preview URL
- **Admin App**: Vercel preview URL
- **Database**: Staging Supabase instance (recommended)
- **Auth**: Clerk development environment
- **Integrations**: Test Kajabi webhooks

### Development Environment

- **Web App**: `http://localhost:3000`
- **Admin App**: `http://localhost:3001`
- **Database**: Local PostgreSQL or Supabase
- **Auth**: Clerk development keys
- **Integrations**: Mock/test endpoints

## Monitoring and Troubleshooting

### Deployment Status

Check deployment status via:

1. **Vercel Dashboard**: Monitor builds and deployments
2. **GitHub Actions**: Check workflow execution
3. **Application Health**: Use smoke test endpoints

### Health Check Endpoints

```bash
# Web App
curl https://leaps.mereka.org/api/health

# Admin App
curl https://admin.leaps.mereka.org/api/health
```

### Common Issues

#### Build Failures

1. **Dependency issues**: Clear `node_modules` and reinstall
2. **Type errors**: Run `pnpm type-check` locally
3. **Database schema**: Ensure `pnpm db:generate` succeeds

#### Runtime Errors

1. **Environment variables**: Verify all required vars are set
2. **Database connectivity**: Check connection strings
3. **Authentication**: Verify Clerk configuration

#### Performance Issues

1. **Cold starts**: Configure function regions
2. **Bundle size**: Analyze with `@next/bundle-analyzer`
3. **Database queries**: Optimize slow queries

### Logs and Debugging

```bash
# Vercel function logs
vercel logs --app=web-app-name

# Vercel deployment logs
vercel logs --app=admin-app-name --follow
```

## Security Considerations

### Environment Variables

- Never commit `.env` files containing secrets
- Use Vercel's environment variable encryption
- Rotate secrets regularly

### Database Access

- Use connection pooling in production
- Implement proper RLS (Row Level Security)
- Monitor database access patterns

### API Security

- Enable CORS restrictions
- Implement rate limiting
- Use secure headers middleware

## Rollback Procedures

### Immediate Rollback

```bash
# Revert to previous deployment in Vercel dashboard
# Or use Vercel CLI
vercel rollback --app=your-app-name
```

### Git-based Rollback

```bash
# Revert the problematic commit
git revert <commit-hash>
git push origin main

# This triggers automatic redeployment
```

### Database Rollbacks

```bash
# Run database migrations in reverse
pnpm db:migrate:rollback

# Or restore from backup if necessary
```

## Performance Optimization

### Build Optimization

- Use `turbo` for parallel builds
- Enable Next.js compiler optimizations
- Implement proper caching strategies

### Runtime Optimization

- Configure appropriate serverless function regions
- Use Next.js Image optimization
- Implement proper CDN caching

### Database Optimization

- Use connection pooling
- Implement query optimization
- Monitor slow query logs

## Maintenance Tasks

### Regular Tasks

1. **Dependency updates**: Monthly security updates
2. **Database maintenance**: Weekly cleanup tasks
3. **Log monitoring**: Daily error log review
4. **Performance monitoring**: Weekly metrics review

### Periodic Tasks

1. **Security audits**: Quarterly security reviews
2. **Backup testing**: Monthly restore testing
3. **Disaster recovery**: Quarterly DR testing
4. **Documentation updates**: As needed

## Support and Resources

### Documentation

- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Turbo Documentation](https://turbo.build/repo/docs)

### Internal Resources

- Project README: `/README.md`
- Architecture Overview: `/CLAUDE.md`
- Database Schema: `/docs/DATABASE.md`
- API Documentation: `/docs/openapi.yaml`

### Emergency Contacts

- **Platform Issues**: Vercel Support
- **Database Issues**: Supabase Support
- **Authentication Issues**: Clerk Support
- **Integration Issues**: Kajabi Support

---

This deployment guide provides comprehensive instructions for managing separate Vercel deployments for both the Web and Admin applications of the MS Elevate LEAPS Tracker platform.
