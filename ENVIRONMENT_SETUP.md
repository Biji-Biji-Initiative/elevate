# Environment Variables Setup Guide

This document provides a comprehensive guide for setting up environment variables for the MS Elevate LEAPS Tracker project.

## Overview

The project uses multiple environment files across different applications:

- **Root level**: `/elevate/.env.local` - Shared configuration
- **Web app**: `/elevate/apps/web/.env.local` - Public participant dashboard
- **Admin app**: `/elevate/apps/admin/.env.local` - Admin/reviewer console

## Required Environment Variables

### 1. Kajabi Integration Variables

#### Required for Production

```bash
# API credentials (obtain from Kajabi Admin dashboard)
KAJABI_API_KEY=your-kajabi-api-key
KAJABI_CLIENT_SECRET=your-kajabi-client-secret

# Base URL for Kajabi API
KAJABI_BASE_URL=https://academy.mereka.my/api

# Alternative syntax (both are supported)
KAJABI_SITE=https://academy.mereka.my/api

# Webhook secret for request validation (minimum 16 characters)
KAJABI_WEBHOOK_SECRET=your-secure-webhook-secret-min-16-chars

# Course completion tags (comma-separated, lowercased)
KAJABI_LEARN_TAGS=elevate-ai-1-completed,elevate-ai-2-completed

# Offer configuration for course access
KAJABI_OFFER_ID=2150602564
KAJABI_OFFER_NAME=QA Test API

# Optional: Public Learn portal URL (used in web UI CTAs)
NEXT_PUBLIC_KAJABI_PORTAL_URL=https://academy.mereka.my/
```

#### Current Development Values

The following values are pre-configured for development:

- `KAJABI_API_KEY`: `3bSjqrBysXjszB3TtFgSSKSV`
- `KAJABI_CLIENT_SECRET`: `bEiFQSQiRzeyHZxfP4En52oo`
- `KAJABI_OFFER_ID`: `2150602564`

### 2. Clerk Authentication Variables

#### Required for All Environments

```bash
# Public key for client-side authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-publishable-key

# Secret key for server-side operations
CLERK_SECRET_KEY=sk_test_your-secret-key

# Webhook secret for Clerk webhooks (for web app)
CLERK_WEBHOOK_SECRET=whsec_your-webhook-secret
```

#### Current Development Values

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: `pk_test_aW4tcmVkYmlyZC02Mi5jbGVyay5hY2NvdW50cy5kZXYk`
- `CLERK_SECRET_KEY`: `sk_test_tWQvYNgYTjrtpr5JARVLwaT8rqGAkwNQWRpbEbcxsa`
- `CLERK_WEBHOOK_SECRET`: `whsec_2v7DTTZcJytslXWs8SjOMfwjV+vmVeQvft7zHMJL5Zw=`

### 3. Application Configuration

#### Site URL

```bash
# Public URL for the application
NEXT_PUBLIC_SITE_URL=https://leaps.mereka.org

# Development values
# Web app: http://localhost:3000
# Admin app: http://localhost:3001
```

#### Database

```bash
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

#### Supabase Storage

```bash
# Supabase configuration for file storage
NEXT_PUBLIC_SUPABASE_URL=https://gsvhfcjmjnocxxosjloi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Setup Instructions

### 1. Initial Setup

```bash
# Copy environment example files
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

### 2. Configure Kajabi Integration

#### Obtain API Credentials

1. Log into Kajabi Admin dashboard
2. Navigate to Settings > Integrations > API
3. Generate new API key and client secret
4. Copy the values to your environment files

#### Configure Webhook Secret

1. Generate a secure random string (minimum 16 characters)
2. Use the same secret across all environments
3. Configure this secret in your Kajabi webhook settings

### 3. Configure Clerk Authentication

#### Setup Google OAuth

1. Create/configure Google Cloud Project
2. Set up OAuth consent screen
3. Create OAuth 2.0 credentials
4. Configure redirect URIs in Google Console
5. Copy client ID and secret to Clerk dashboard

#### Obtain Clerk Keys

1. Sign in to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create new application or select existing
3. Configure Google as authentication provider
4. Copy publishable key and secret key
5. Generate webhook secret for production

### 4. Environment-Specific Configuration

#### Development

- Use local database (PostgreSQL via Docker)
- Local Supabase instance or development project
- Development Clerk keys
- Placeholder webhook secrets are acceptable

#### Production

- All secrets must be real values
- Webhook secrets are required for security
- Use production Supabase project
- Configure proper CORS and security headers

## Security Best Practices

### Secret Management

- **Never commit real secrets to version control**
- Use placeholder values in `.env.example` files
- Store production secrets in secure environment variable systems
- Rotate secrets regularly

### Webhook Security

- Use strong, unique webhook secrets (minimum 16 characters)
- Verify webhook signatures in production
- Use HTTPS endpoints for webhook URLs
- Implement proper rate limiting

### Access Control

- Limit API key permissions to minimum required
- Use service accounts for production
- Implement proper role-based access controls
- Monitor API usage and audit logs

## Validation

### Environment Validation Script

The project includes environment validation:

```bash
# Run validation
npm run validate:env

# Or check specific app
cd apps/web && npm run validate:env
cd apps/admin && npm run validate:env
```

### Manual Verification

1. **Kajabi Connection**: Check admin health endpoint
2. **Clerk Authentication**: Test sign-in flow
3. **Database**: Verify connection and migrations
4. **Webhooks**: Test webhook endpoints with curl

### Admin Analytics Configuration

You can customize points distribution in the Admin analytics dashboard using these optional env vars (set in root or `apps/admin/.env.local`):

```bash
# Comma-separated integer thresholds; defaults to 0,50,100,200,500
ANALYTICS_POINTS_BUCKETS=0,25,50,100,250,500

# Quantile mode (2–10). If set, overrides buckets and renders labels like
# Q1 (≤ X) ... Qn (+). Example for quartiles:
ANALYTICS_POINTS_QUANTILES=4
```

Notes:
- Only set one of the vars; quantiles take precedence if both are present.
- These envs are read at runtime by the admin service; see `apps/admin/lib/server/analytics-service.ts`.

## Troubleshooting

### Common Issues

#### Kajabi API Connection Failed

- Verify API key and client secret
- Check base URL configuration
- Ensure network connectivity to Kajabi
- Verify API key permissions

#### Clerk Authentication Errors

- Check publishable key format (must start with `pk_`)
- Verify secret key format (must start with `sk_`)
- Ensure Google OAuth is properly configured
- Check redirect URIs in Google Console

#### Webhook Signature Validation Failed

- Verify webhook secret matches configuration
- Check webhook URL is accessible
- Ensure proper HTTPS configuration
- Verify request headers and body

### Debug Commands

```bash
# Check environment variables
printenv | grep KAJABI
printenv | grep CLERK

# Test database connection
npm run db:test

# Validate environment
npm run env:check
```

## File Locations

### Environment Files

- `/elevate/.env.example` - Root example file
- `/elevate/.env.local` - Root local configuration
- `/elevate/apps/web/.env.example` - Web app example
- `/elevate/apps/web/.env.local` - Web app local configuration
- `/elevate/apps/admin/.env.example` - Admin app example
- `/elevate/apps/admin/.env.local` - Admin app local configuration

### Configuration Files

- `/elevate/packages/config/src/env.ts` - Environment schema validation
- `/elevate/packages/integrations/src/kajabi.ts` - Kajabi client implementation

## Support

For additional help:

1. Check the [Documentation Index](docs/README.md)
2. Review the [deployment guide](docs/DEPLOYMENT.md)
3. Consult the [operations runbook](docs/runbooks/deploy.md)
