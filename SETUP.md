# MS Elevate LEAPS Tracker - Setup Guide

## Quick Start

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd elevate
   pnpm setup  # Installs dependencies and creates .env files
   ```

2. **Configure environment variables:**
   - Update `.env.local` (root)
   - Update `apps/web/.env.local`
   - Update `apps/admin/.env.local`

3. **Setup database:**
   ```bash
   pnpm db:setup  # Creates schema, seeds data, and sets up views
   ```

4. **Start development:**
   ```bash
   pnpm dev  # Starts both web (3000) and admin (3001) apps
   ```

## Environment Configuration

### Required Environment Variables

#### Root `.env.local`
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/elevate_dev
SEED_ADMIN_ID=user_2xxx_admin_example
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_NAME=Admin User
SEED_ADMIN_HANDLE=admin
KAJABI_WEBHOOK_SECRET=your-kajabi-webhook-secret
```

#### Web App `apps/web/.env.local`
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://user:password@localhost:5432/elevate_dev
NEXT_PUBLIC_SITE_URL=http://localhost:3000
KAJABI_WEBHOOK_SECRET=your-kajabi-webhook-secret
```

#### Admin App `apps/admin/.env.local`
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
DATABASE_URL=postgresql://user:password@localhost:5432/elevate_dev
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

## Database Setup

### Prerequisites
- PostgreSQL 15+ running locally or accessible via DATABASE_URL
- Valid DATABASE_URL in environment variables

### Automatic Setup
```bash
pnpm db:setup
```

### Manual Setup Steps
```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed initial data (activities, badges, admin user)
pnpm db:seed

# Create materialized views (leaderboard, metrics)
pnpm exec prisma db execute --stdin < packages/db/migrations/002_views.sql
```

### Database Management Commands
```bash
pnpm db:studio     # Open Prisma Studio
pnpm db:reset      # Reset database (destructive)
pnpm db:migrate    # Create and apply migration
```

## Authentication Setup (Clerk)

1. **Create Clerk Application:**
   - Go to [clerk.com](https://clerk.com) and create a new application
   - Enable Google OAuth provider
   - Copy publishable and secret keys to your .env files

2. **Configure Google OAuth:**
   - Create GCP project and OAuth 2.0 credentials
   - Add authorized redirect URIs for Clerk
   - Configure OAuth consent screen

3. **Set up Webhooks:**
   - In Clerk Dashboard, go to Webhooks
   - Add endpoint: `http://localhost:3000/api/webhooks/clerk`
   - Select user events: `user.created`, `user.updated`, `user.deleted`
   - Copy webhook secret to CLERK_WEBHOOK_SECRET

## Storage Setup (Supabase)

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com) and create a project
   - Copy project URL and service role key

2. **Configure Storage Bucket:**
   - Create a private bucket called `evidence`
   - Set appropriate RLS policies for file access

## Development Workflow

### Project Structure
```
elevate/
├── apps/
│   ├── web/          # Public site + participant dashboard (port 3000)
│   └── admin/        # Admin console (port 3001)
├── packages/
│   ├── db/           # Prisma schema, client, migrations
│   ├── auth/         # RBAC helpers, Clerk integration
│   ├── config/       # Environment validation
│   ├── types/        # Zod schemas
│   ├── storage/      # Supabase utilities
│   ├── logic/        # Business logic
│   └── ui/           # Shared components
└── scripts/          # Setup and deployment scripts
```

### Available Scripts
```bash
# Development
pnpm dev              # Start both apps in development
pnpm build            # Build all apps for production

# Setup
pnpm setup            # Initial project setup
pnpm db:setup         # Database initialization

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema without migration
pnpm db:migrate       # Create and apply migration
pnpm db:seed          # Seed initial data
pnpm db:studio        # Open database GUI
pnpm db:reset         # Reset database (destructive)

# Package management
pnpm -F web [command] # Run command in web app
pnpm -F admin [command] # Run command in admin app
```

### User Roles and Permissions

#### Role Hierarchy (lowest to highest)
1. **Participant** - Default role for new users
   - Submit LEAPS evidence
   - View own profile and progress
   - View public leaderboard

2. **Reviewer** - Can review submissions
   - All participant permissions
   - Access review queue
   - Approve/reject submissions
   - View submission analytics

3. **Admin** - Full management access
   - All reviewer permissions
   - Manage user roles
   - Export data
   - Configure system settings

4. **Superadmin** - System administration
   - All admin permissions
   - Access system logs
   - Modify configuration
   - Manage other admins

#### Setting User Roles
Roles are managed via Clerk's public metadata:
```javascript
// In Clerk Dashboard or via API
{
  "publicMetadata": {
    "role": "reviewer"  // participant | reviewer | admin | superadmin
  }
}
```

## LEAPS Framework Implementation

### Activity Scoring
- **Learn**: 20 points (certificate upload or Kajabi auto-credit)
- **Explore**: 50 points (classroom application with evidence)
- **Amplify**: Variable points (2 per peer, 1 per student, capped)
- **Present**: 20 points (LinkedIn post verification)
- **Shine**: Recognition only (no points in MVP)

### Anti-Gaming Measures
- Amplify submission caps (50 peers, 200 students max)
- 7-day rolling limits on submissions
- Certificate hash deduplication
- Reviewer bounded point overrides
- Append-only audit trail

## Integration Points

### Kajabi Webhook
- Endpoint: `POST /api/kajabi/webhook`
- Purpose: Auto-credit Learn activity completions
- Authentication: Shared secret validation
- Processing: Idempotent via external_event_id

### Supabase Storage
- Private bucket for evidence files
- Signed URLs with 1-hour TTL
- File type/size validation
- CDN acceleration for public assets

## Monitoring and Debugging

### Development Tools
```bash
pnpm db:studio        # Database GUI
```

### Health Checks
- Web app: `http://localhost:3000/api/health`
- Admin app: `http://localhost:3001/api/health`

### Common Issues

#### Database Connection Failed
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists

#### Authentication Not Working
- Verify Clerk keys are correct
- Check webhook endpoint is accessible
- Confirm Google OAuth setup

#### File Upload Issues
- Check Supabase configuration
- Verify bucket exists and is accessible
- Confirm CORS settings

## Deployment

### Environment Preparation
1. Set up production database (PostgreSQL)
2. Configure Clerk for production domain
3. Set up Supabase project for production
4. Update environment variables

### Deploy to Vercel
```bash
# Build check
pnpm build

# Deploy
vercel deploy --prod
```

### Post-Deployment
1. Run database migrations
2. Refresh materialized views
3. Test critical user flows
4. Monitor error rates

## Support

For detailed technical documentation, refer to:
- `CLAUDE.md` - Project overview and business context
- `packages/db/schema.prisma` - Database schema
- `packages/auth/` - Authentication and authorization
- API documentation in `/docs` folder

## Contributing

1. Create feature branch from `main`
2. Make changes following existing patterns
3. Test locally with `pnpm dev`
4. Create PR with clear description
5. Ensure CI passes before merging