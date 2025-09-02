# MS Elevate LEAPS Tracker - Deployment Guide

## Overview

This guide covers the complete setup and deployment process for the MS Elevate LEAPS Tracker, including Supabase integration, email services, localization, and Vercel deployment.

## Prerequisites

- Node.js 18+ and pnpm
- Supabase CLI
- Vercel CLI (for deployment)
- PostgreSQL database (Supabase recommended)

## Quick Start

### 1. Environment Setup

```bash
# Clone and install dependencies
pnpm install

# Check environment variables
pnpm run env:check development

# Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your actual values
```

### 2. Database Setup

```bash
# Set up database with migrations and seed data
pnpm run db:deploy development

# Or manually:
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
```

### 3. Local Development

```bash
# Start both web and admin apps
pnpm dev

# Or start individually:
pnpm -F web dev    # http://localhost:3000
pnpm -F admin dev  # http://localhost:3001

# Email template development
pnpm run emails:dev # http://localhost:3002
```

## Service Configurations

### Supabase Setup

1. **Create Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Get Credentials**: Copy URL and service role key from Settings > API
3. **Configure Storage**: 
   ```sql
   -- Evidence bucket is created via migration
   -- Verify in Supabase dashboard > Storage
   ```
4. **Set Environment Variables**:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE=your-service-role-key
   ```

### Clerk Authentication

1. **Create Application**: Go to [clerk.com](https://clerk.com) and create a new application
2. **Configure OAuth**: Add Google provider in Clerk dashboard
3. **Set Domains**: Add your domain to allowed origins
4. **Get Keys**: Copy publishable and secret keys
5. **Environment Variables**:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

### Resend Email Service

1. **Create Account**: Sign up at [resend.com](https://resend.com)
2. **Get API Key**: Generate API key in dashboard
3. **Verify Domain**: Add and verify your sending domain
4. **Environment Variables**:
   ```bash
   RESEND_API_KEY=re_...
   FROM_EMAIL=MS Elevate <noreply@leaps.mereka.org>
   REPLY_TO_EMAIL=support@leaps.mereka.org
   ```

### Kajabi Integration

1. **Webhook Setup**: Configure in Kajabi dashboard
2. **Generate Secret**: Create a strong webhook secret
3. **Form Configuration**: Set up completion forms in Kajabi courses
4. **Environment Variables**:
   ```bash
   KAJABI_WEBHOOK_SECRET=your-strong-secret
   ```

## Deployment

### Staging Deployment

```bash
# Deploy to Vercel staging
pnpm run deploy:staging

# Manual steps:
vercel --yes  # Creates preview deployment
```

### Production Deployment

```bash
# Run pre-deployment checks
pnpm run env:check production
pnpm run type-check
pnpm run lint

# Deploy to production
pnpm run deploy:prod

# Manual steps:
pnpm run db:migrate:prod  # Run migrations first
vercel --prod --yes       # Deploy to production
```

### Environment Variables (Vercel)

Set these in Vercel dashboard or via CLI:

```bash
# Required for all environments
vercel env add DATABASE_URL
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add RESEND_API_KEY
vercel env add KAJABI_WEBHOOK_SECRET
vercel env add NEXT_PUBLIC_SITE_URL

# Production only
vercel env add CRON_SECRET production
```

## Monitoring and Maintenance

### Health Checks

- **Endpoint**: `/api/health`
- **Monitoring**: Check database connection and environment
- **Alerts**: Set up monitoring for 5xx errors

### Scheduled Tasks

- **Leaderboard Refresh**: Every 5 minutes (`/api/cron/refresh-leaderboards`)
- **Weekly Emails**: Mondays at 10 AM (`/api/cron/weekly-progress-emails`)
- **Cleanup**: Daily at 2 AM (`/api/cron/cleanup-temp-files`)

### Database Maintenance

```bash
# Refresh materialized views manually
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://leaps.mereka.org/api/cron/refresh-leaderboards

# Check database performance
pnpm run db:studio
```

## Troubleshooting

### Common Issues

1. **Migration Errors**:
   ```bash
   # Reset and re-run migrations
   pnpm run db:reset
   pnpm run db:migrate
   ```

2. **Build Failures**:
   ```bash
   # Clear cache and rebuild
   pnpm run clean
   pnpm install
   pnpm run build
   ```

3. **Email Not Sending**:
   - Check Resend API key and domain verification
   - Verify FROM_EMAIL domain matches verified domain
   - Check email service status

4. **Authentication Issues**:
   - Verify Clerk keys match environment
   - Check allowed domains in Clerk dashboard
   - Ensure middleware configuration is correct

### Debug Commands

```bash
# Environment validation
pnpm run env:check production

# Database connection test
pnpm run db:studio

# View recent logs (Vercel)
vercel logs --follow

# Test webhook locally (ngrok required)
ngrok http 3000
# Use ngrok URL in Kajabi webhook configuration
```

## Security Considerations

### Environment Variables

- Never commit sensitive keys to version control
- Use different keys for staging/production
- Rotate keys regularly
- Use Vercel's environment variable encryption

### Database Security

- Enable Row Level Security (RLS) - ✅ Configured
- Use service role key only on server-side
- Regular backups via Supabase
- Monitor unusual query patterns

### File Upload Security

- File type validation - ✅ Configured
- File size limits (10MB) - ✅ Configured
- Virus scanning (recommended for production)
- Content hash deduplication - ✅ Configured

## Performance Optimization

### Database

- Materialized views for leaderboards - ✅ Configured
- Proper indexing on queries - ✅ Configured
- Connection pooling via Vercel
- Query optimization monitoring

### Caching

- Next.js static generation where possible
- Vercel Edge Network caching
- Materialized view refresh (5-minute intervals)

### File Storage

- Direct uploads to Supabase Storage
- Signed URLs with 1-hour TTL
- Automatic file compression
- CDN distribution via Supabase

## Backup and Recovery

### Database Backups

- Automatic daily backups via Supabase
- Point-in-time recovery available
- Export critical data regularly

### File Backups

- Supabase Storage automatic replication
- Consider additional backup strategy for critical files

## Support and Maintenance

### Regular Tasks

- [ ] Weekly: Review error rates and performance
- [ ] Monthly: Security audit and dependency updates
- [ ] Quarterly: Performance optimization review
- [ ] Bi-annually: Full security audit

### Key Metrics to Monitor

- User registration/activation rates
- Submission approval turnaround time
- Email delivery rates
- API response times
- Error rates by endpoint

### Support Contacts

- Technical Issues: Check GitHub repository
- Supabase: Support via dashboard
- Clerk: Support via dashboard
- Resend: Support via dashboard
- Vercel: Support via dashboard

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Resend Documentation](https://resend.com/docs)