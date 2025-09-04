# Legacy Migration Archive

This directory contains historical migration files and documentation that are no longer actively used in the current system but are preserved for reference.

## Directory Structure

### SQL Migrations (Legacy)
- `legacy_sql/` - Contains the original SQL migration files that were consolidated
- These were replaced by the consolidated migration system in `packages/db/migrations/`

### Import Migration Scripts
- `ui-import-migration.cjs` - Script used to migrate UI component imports to subpath exports
- This was a one-time migration tool and is no longer needed

### Documentation
- `logging-migration-plan.md` - Planning document for logging system migration
- This document is complete and the migration has been implemented

## Migration History

### Phase 1: Initial Schema Setup (Sept 2024)
Original SQL files were consolidated into a single migration:
- `001_init.sql` → `20250904011005_init_consolidated/migration.sql`
- `002_views.sql` → Integrated into consolidated migration
- Other numbered files integrated as needed

### Phase 2: UI Import Restructuring (Sept 2024)  
Component imports were migrated from root exports to subpath exports:
- `import { FileUpload } from '@elevate/ui'` → `import { FileUpload } from '@elevate/ui/blocks'`
- Migration completed via automated script

### Phase 3: Logging System Upgrade (Sept 2024)
Console logging was migrated to structured Pino logging:
- All packages now use `@elevate/logging` package
- Structured logs with proper levels and context
- Production-ready logging infrastructure

## Current Status

All legacy migrations have been completed and the files in this archive are for historical reference only. The active migration system is located at:

- `packages/db/migrations/` - Active Prisma migrations
- `supabase/migrations/` - Supabase-specific migrations (if applicable)

## Cleanup Notes

Files archived here should not be deleted as they provide important context for:
- Historical schema decisions
- Migration rollback procedures (if needed)
- Understanding the evolution of the system architecture