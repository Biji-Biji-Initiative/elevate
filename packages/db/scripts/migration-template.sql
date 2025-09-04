-- Migration: [DESCRIPTIVE_NAME]
-- Date: [DATE]
-- Author: [AUTHOR]
-- Description: [DETAILED_DESCRIPTION]
--
-- This migration [WHAT_IT_DOES]
-- 
-- Dependencies:
-- - [LIST_ANY_DEPENDENCIES]
--
-- Rollback instructions:
-- [ROLLBACK_STEPS_IF_MANUAL_INTERVENTION_NEEDED]

-- ============================================================================
-- Schema Changes
-- ============================================================================

-- Example: Add new column
-- ALTER TABLE "table_name" ADD COLUMN "new_column" TEXT DEFAULT 'default_value';

-- Example: Create new table
-- CREATE TABLE "new_table" (
--     "id" TEXT NOT NULL,
--     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT "new_table_pkey" PRIMARY KEY ("id")
-- );

-- Example: Add index (use CONCURRENTLY for production)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_table_column" 
-- ON "table_name"("column_name");

-- ============================================================================
-- Data Migration (if needed)
-- ============================================================================

-- Example: Populate new column with computed values
-- UPDATE "table_name" 
-- SET "new_column" = 'computed_value'
-- WHERE "condition" = true;

-- ============================================================================
-- Business Logic (triggers, constraints, functions)
-- ============================================================================

-- Example: Add constraint
-- ALTER TABLE "table_name" 
-- ADD CONSTRAINT "constraint_name" 
-- CHECK ("column" IS NOT NULL);

-- Example: Create function
-- CREATE OR REPLACE FUNCTION function_name() RETURNS trigger AS $$
-- BEGIN
--   -- Function logic here
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Example: Create trigger
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON "table_name"
-- FOR EACH ROW EXECUTE PROCEDURE function_name();

-- ============================================================================
-- Performance Optimizations (views, indexes)
-- ============================================================================

-- Example: Materialized view
-- CREATE MATERIALIZED VIEW view_name AS
-- SELECT column1, COUNT(*) as count
-- FROM table_name
-- GROUP BY column1;

-- CREATE INDEX idx_view_name ON view_name(column1);

-- ============================================================================
-- Post-Migration Tasks
-- ============================================================================

-- TODO: Update seed data if needed
-- TODO: Refresh materialized views: SELECT refresh_leaderboards();
-- TODO: Verify application compatibility
-- TODO: Update documentation