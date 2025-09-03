# Vercel Deployment Configuration Guide

## Overview

This guide explains the clean deployment strategy for the MS Elevate LEAPS Tracker monorepo, which consists of two independent applications:

- **Web App** (`elevate-web`) - Public facing site and participant dashboard
- **Admin App** (`elevate-admin`) - Administrative console for reviewers and admins

## Architecture

### Independent Deployments

Each app is deployed as a separate Vercel project to ensure:
- **Isolation**: No configuration conflicts or environment variable mix-ups
- **Scalability**: Independent scaling and resource allocation
- **Security**: Separate domains and access controls
- **Maintenance**: Individual deployment cycles and rollbacks

### Project Structure

```
/elevate/
├── vercel.json                    # Web app deployment config
├── apps/
│   ├── web/                      # Public site + participant dashboard
│   │   └── .vercel/              # Web app Vercel project settings
│   └── admin/                    # Admin console
│       ├── vercel.json           # Admin app deployment config
│       └── (no .vercel/ yet)     # Admin project settings (created on first deploy)
```

## Configuration Details

### Web App Configuration (`/vercel.json`)

```json
{
  "name": "elevate-web",
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
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-App-Name",
          "value": "elevate-web"
        }
      ]
    }
  ]
}
```

**Key Features:**
- Builds only the web app using Turbo's filter
- Outputs to correct Next.js build directory
- 30-second API timeout for webhook processing
- Identifies responses with `X-App-Name` header

### Admin App Configuration (`/apps/admin/vercel.json`)

```json
{
  "name": "elevate-admin",
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
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-App-Name",
          "value": "elevate-admin"
        }
      ]
    }
  ]
}
```

**Key Features:**
- Navigates to monorepo root for build context
- Builds only the admin app using Turbo's filter
- Outputs to local `.next` directory
- Separate API route configuration
- Identifies responses with `X-App-Name` header

## Deployment Instructions

### First-Time Setup

#### Web App Setup

1. **From repository root:**
```bash
cd /Users/agent-g/elevate/elevate

# Initialize Vercel project (if not already linked)
vercel link

# Deploy to staging
vercel deploy

# Deploy to production
vercel deploy --prod
```

#### Admin App Setup

1. **From admin directory:**
```bash
cd /Users/agent-g/elevate/elevate/apps/admin

# Initialize Vercel project
vercel link

# Deploy to staging
vercel deploy

# Deploy to production
vercel deploy --prod
```

### Using Deployment Scripts

The repository includes optimized deployment scripts:

#### Web App Deployment
```bash
# From repository root
./scripts/deploy-web.sh staging
./scripts/deploy-web.sh production
```

#### Admin App Deployment
```bash
# From repository root
./scripts/deploy-admin.sh staging
./scripts/deploy-admin.sh production
```

#### Both Apps Deployment
```bash
# Deploy both apps
./scripts/deploy-apps.sh staging
./scripts/deploy-apps.sh production
```

## Environment Variables

### Required for Both Apps

Set these in each Vercel project:

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Integrations
KAJABI_WEBHOOK_SECRET=...
RESEND_API_KEY=...

# App Configuration
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org
CRON_SECRET=... (production only)
```

### Setting Environment Variables

#### Via Vercel CLI
```bash
# Set for both staging and production
vercel env add DATABASE_URL
vercel env add SUPABASE_URL
# ... repeat for all variables

# Set production-only variables
vercel env add CRON_SECRET production
```

#### Via Vercel Dashboard
1. Go to project settings
2. Navigate to Environment Variables
3. Add each variable for appropriate environments

## Domain Configuration

### Recommended Setup

- **Web App**: `leaps.mereka.org` (production), `staging-web.leaps.mereka.org` (staging)
- **Admin App**: `admin.leaps.mereka.org` (production), `staging-admin.leaps.mereka.org` (staging)

### Configure Custom Domains

1. In Vercel dashboard for each project
2. Go to Settings > Domains
3. Add custom domain
4. Update DNS records as instructed

## Monitoring and Troubleshooting

### Deployment Status

Check deployment status in Vercel dashboard or via CLI:

```bash
# List deployments for web app (from root)
vercel ls

# List deployments for admin app (from admin directory)
cd apps/admin && vercel ls
```

### Build Logs

View build logs to troubleshoot issues:

```bash
# View latest deployment logs
vercel logs

# Follow logs in real-time
vercel logs --follow
```

### Common Issues and Solutions

#### 1. Build Command Failures

**Problem**: `pnpm turbo run build --filter=...` fails

**Solutions**:
- Ensure Turbo is properly configured in `turbo.json`
- Check that package names match filter patterns
- Verify all dependencies are installed

#### 2. Environment Variable Issues

**Problem**: Missing or incorrect environment variables

**Solutions**:
- Use `vercel env ls` to check configured variables
- Ensure variables are set for correct environments (development/preview/production)
- Check that sensitive values aren't exposed in client-side code

#### 3. Database Connection Issues

**Problem**: Cannot connect to database during build

**Solutions**:
- Verify `DATABASE_URL` is correctly set
- Ensure database is accessible from Vercel's network
- Check if migrations need to be run

#### 4. Function Timeout Issues

**Problem**: API routes timing out

**Solutions**:
- Verify 30-second timeout is sufficient for your operations
- Consider breaking down long operations into smaller chunks
- Use background job processing for heavy tasks

## Security Considerations

### Environment Variable Management

- Use different database instances for staging/production
- Rotate webhook secrets regularly
- Never commit secrets to version control
- Use Vercel's encrypted environment variables

### Domain Security

- Enable HTTPS on all custom domains
- Configure proper CORS policies
- Set secure cookie attributes in production

### Access Control

- Use different authentication keys for staging/production
- Implement proper role-based access control
- Monitor admin access patterns

## Performance Optimization

### Build Optimization

- Use Turbo's caching for faster builds
- Enable Next.js incremental static regeneration where applicable
- Optimize bundle sizes using Next.js analyzer

### Runtime Optimization

- Configure proper caching headers
- Use Vercel's Edge Network for static assets
- Optimize database queries and connection pooling

## Maintenance Tasks

### Regular Tasks

- [ ] Monitor deployment success rates
- [ ] Review build times and optimize if needed
- [ ] Update dependencies regularly
- [ ] Check environment variable security
- [ ] Verify domain configurations

### Emergency Procedures

#### Rollback Deployment

```bash
# List recent deployments
vercel ls

# Promote specific deployment to production
vercel promote <deployment-url> --prod
```

#### Database Issues

```bash
# Check database connectivity
pnpm db:studio

# Run migrations manually
pnpm db:migrate:prod
```

## Support

### Getting Help

1. Check Vercel deployment logs first
2. Review this documentation
3. Check repository issues
4. Contact the development team

### Useful Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Turbo Documentation](https://turbo.build/docs)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)

---

*Last Updated: September 2025*