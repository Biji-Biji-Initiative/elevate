# Database Setup for MS Elevate LEAPS Tracker

This directory contains database setup scripts and configurations for the MS Elevate LEAPS Tracker application.

## PostgreSQL Database Setup

The application uses PostgreSQL as its database. You can set it up in several ways:

### Option 1: Supabase Local (Recommended)

1. **Install Supabase CLI:**
   https://supabase.com/docs/guides/local-development

2. **Start local stack:**
   ```bash
   supabase start
   ```

3. **Update your environment:**
   Ensure your `.env.local` has (ports match `supabase/config.toml`):
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
   ```

### Option 2: Hosted PostgreSQL (Supabase Cloud)

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your database URL from Settings > Database
3. Update your `.env.local`:
   ```bash
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```

### Option 3: Local PostgreSQL Installation (Alternative)

If you prefer a native Postgres install, configure your connection string accordingly in `.env.local`. The project does not require Docker Compose.

## Database Initialization

Once PostgreSQL is running, initialize the database:

```bash
# Generate Prisma client
pnpm db:generate

# Push schema and seed data
pnpm db:init

# Or run the comprehensive setup script
pnpm db:setup
```

## Available Scripts

- `pnpm db:setup` - Complete database setup with health checks
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push schema to database
- `pnpm db:seed` - Seed initial data
- `pnpm db:init` - Push schema and seed (shortcut)
- `pnpm db:studio` - Open Prisma Studio
- `pnpm db:reset` - Reset database (development only)

## Files in this Directory

- `init.sql` - Database initialization script (run by Docker on first start)
- `README.md` - This documentation
- `check-drift.sh` - Check for schema drift (if exists)
- `generate-migrations.sh` - Generate SQL migrations (if exists)
- `sync-supabase.sh` - Sync with Supabase (if exists)

## Troubleshooting

### Connection Issues

1. **Supabase Local not running:**
   ```bash
   supabase status   # Check status
   supabase start    # Start services
   ```

2. **Wrong port:**
   ```bash
   # Ensure your DATABASE_URL uses port 54322 (see supabase/config.toml)
   export DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
   ```

### Schema Issues

1. **Schema out of sync:**
   ```bash
   pnpm db:push
   ```

2. **Migration conflicts:**
   ```bash
   pnpm db:reset  # Development only!
   pnpm db:init
   ```

## Environment Variables

Required for database connection:

```bash
# PostgreSQL connection string (Supabase Local default)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Optional: Database pool settings (production)
DATABASE_POOL_MAX=10
DATABASE_POOL_TIMEOUT=30000
```

## Production Considerations

- Use connection pooling (PgBouncer) for production
- Enable SSL for remote connections
- Set up regular backups
- Monitor database performance
- Use read replicas for high-traffic scenarios

## Need Help?

- Check the main project documentation in `/CLAUDE.md`
- Review Prisma documentation for schema changes
- Check Supabase Local status: `supabase status` (or restart with `supabase stop && supabase start`)
- Verify environment variables: `pnpm env:check`
