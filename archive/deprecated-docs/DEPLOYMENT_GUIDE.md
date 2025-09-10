# MS Elevate Indonesia - Deployment Guide

> ⚠️ **DEPRECATED**: This guide has been consolidated. See the canonical [Deployment Guide](docs/DEPLOYMENT.md) for the most up-to-date information.

## Prerequisites

- [x] Supabase project created (`gsvhfcjmjnocxxosjloi`)
- [x] Database migrations applied
- [x] Resend API key configured (`re_H7A8pYJd_9HD8ZuhNtUhTstgieKrj8cAf`)
- [ ] Clerk application created
- [ ] Google OAuth configured
- [ ] Vercel account with project access

## Step-by-Step Deployment

### 1. Set Up Clerk Authentication

```bash
# Open Clerk Dashboard
pnpm setup:clerk

# Or use automated setup
pnpm setup:clerk-auto
```

Follow the guide in [CLERK_SETUP.md](./CLERK_SETUP.md)

### 2. Configure Environment Variables

Ensure all `.env.local` files have:

- ✅ Supabase credentials
- ✅ Database URL
- ✅ Resend API key
- ⏳ Clerk keys (pending setup)
- ⏳ Kajabi webhook secret (optional)

### 3. Test Locally

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run development servers
pnpm dev
```

Visit:

- Web app: http://localhost:3000
- Admin app: http://localhost:3001

### 4. Deploy to Vercel

#### Option A: Automated Deployment (Recommended)

```bash
# Deploy both apps
pnpm deploy:vercel
```

#### Option B: Manual Deployment

```bash
# Deploy web app
cd apps/web
vercel --prod

# Deploy admin app
cd ../admin
vercel --prod
```

#### Option C: Using Deploy Script

```bash
# Run deployment script
./scripts/deploy-apps.sh
```

## Environment Variables for Vercel

### Required for Both Apps

```env
# Database
DATABASE_URL=postgresql://postgres.gsvhfcjmjnocxxosjloi:ElevateIndo2025!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gsvhfcjmjnocxxosjloi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmhmY2ptam5vY3h4b3NqbG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDAwNDgsImV4cCI6MjA3MjM3NjA0OH0.yNzspqL27r9ML_yT7JZiaCSXDnLPdvOibEDeyIJmav0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdmhmY2ptam5vY3h4b3NqbG9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgwMDA0OCwiZXhwIjoyMDcyMzc2MDQ4fQ._EMvj8nN3SSB_p0WmTSR9VC0pd5e6wPWWCB32Se0was

# Clerk (pending setup)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Email
RESEND_API_KEY=re_H7A8pYJd_9HD8ZuhNtUhTstgieKrj8cAf
FROM_EMAIL=noreply@elevate-indonesia.com
REPLY_TO_EMAIL=support@elevate-indonesia.com
```

### Web App Only

```env
NEXT_PUBLIC_SITE_URL=https://elevate-indonesia.vercel.app
CLERK_WEBHOOK_SECRET=whsec_...
KAJABI_WEBHOOK_SECRET=...
```

### Admin App Only

```env
NEXT_PUBLIC_SITE_URL=https://elevate-indonesia-admin.vercel.app
```

## Post-Deployment Checklist

### Immediate Tasks

- [ ] Verify both apps are accessible
- [ ] Test Google OAuth sign-in
- [ ] Check database connectivity
- [ ] Verify Supabase storage access
- [ ] Test email sending with Resend

### Configuration Tasks

- [ ] Set custom domains in Vercel
- [ ] Configure production Clerk keys
- [ ] Update Google OAuth redirect URIs
- [ ] Set up Kajabi webhook
- [ ] Configure monitoring (Sentry/LogRocket)

### Testing Tasks

- [ ] Complete user registration flow
- [ ] Submit test evidence for each LEAPS stage
- [ ] Test admin review process
- [ ] Verify leaderboard updates
- [ ] Check email notifications

## Production URLs

### Applications

- **Web App**: https://elevate-indonesia.vercel.app
- **Admin App**: https://elevate-indonesia-admin.vercel.app

### API Endpoints

- **Kajabi Webhook**: https://elevate-indonesia.vercel.app/api/kajabi/webhook
- **Clerk Webhook**: https://elevate-indonesia.vercel.app/api/clerk/webhook
- **Health Check**: https://elevate-indonesia.vercel.app/api/health

### External Services

- **Supabase Dashboard**: https://supabase.com/dashboard/project/gsvhfcjmjnocxxosjloi
- **Clerk Dashboard**: https://dashboard.clerk.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Google Cloud Console**: https://console.cloud.google.com/project/ms-elevate-indonesia-2025

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
pnpm clean
pnpm install
pnpm build
```

### Database Connection Issues

```bash
# Test database connection
pnpm db:studio

# Reset and reseed database
pnpm db:reset
pnpm db:seed
```

### Deployment Failures

```bash
# Check Vercel logs
vercel logs

# Redeploy with verbose output
vercel --prod --debug
```

### Authentication Issues

1. Verify Clerk keys in environment variables
2. Check Google OAuth configuration
3. Ensure redirect URIs match production URLs
4. Review Clerk Dashboard logs

## Monitoring

### Application Logs

```bash
# View recent logs
vercel logs https://elevate-indonesia.vercel.app --follow

# View admin logs
vercel logs https://elevate-indonesia-admin.vercel.app --follow
```

### Database Monitoring

- Supabase Dashboard > Database > Query Performance
- Check slow queries and index usage

### Error Tracking

- Set up Sentry for production error tracking
- Configure alerts for critical errors

## Rollback Procedure

If deployment issues occur:

```bash
# List recent deployments
vercel list

# Rollback to previous version
vercel rollback [deployment-url]

# Or promote specific deployment
vercel promote [deployment-url]
```

## Support Contacts

- **Technical Issues**: Create issue in repository
- **Clerk Support**: support@clerk.com
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.io

## Security Notes

- Never commit `.env.local` files
- Rotate API keys regularly
- Use different keys for staging/production
- Enable 2FA on all service accounts
- Review access logs regularly

---

Last Updated: January 2025
