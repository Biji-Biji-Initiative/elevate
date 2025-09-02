# Database Setup for MS Elevate LEAPS Tracker

This directory contains database setup scripts and configurations for the MS Elevate LEAPS Tracker application.

## PostgreSQL Database Setup

The application uses PostgreSQL as its database. You can set it up in several ways:

### Option 1: Docker Compose (Recommended for Local Development)

1. **Start PostgreSQL container:**
   ```bash
   docker-compose up -d postgres
   ```

2. **Verify PostgreSQL is running:**
   ```bash
   docker-compose logs postgres
   ```

3. **Update your environment:**
   Ensure your `.env.local` has:
   ```bash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/elevate_leaps
   ```

### Option 2: Supabase (Cloud PostgreSQL)

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your database URL from Settings > Database
3. Update your `.env.local`:
   ```bash
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```

### Option 3: Local PostgreSQL Installation

1. Install PostgreSQL on your system
2. Create a database named `elevate_leaps`
3. Update your `.env.local` with the appropriate connection string

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

1. **Port already in use:**
   ```bash
   # Check what's using port 5432
   lsof -i :5432
   
   # Stop Docker container and try again
   docker-compose down
   docker-compose up -d postgres
   ```

2. **Database doesn't exist:**
   ```bash
   # Recreate the database
   docker-compose down -v  # Remove volumes
   docker-compose up -d postgres
   ```

3. **Permission denied:**
   ```bash
   # Fix Docker permissions (macOS/Linux)
   sudo chown -R $(whoami) ~/.docker
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
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:password@localhost:5432/elevate_leaps

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
- Check Docker logs: `docker-compose logs postgres`
- Verify environment variables: `pnpm env:check`