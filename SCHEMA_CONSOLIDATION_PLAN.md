# Database Schema Consolidation Plan

## Current State Analysis

### Schema Drift Issues Identified

1. **Missing Fields**:
   - `kajabi_contact_id` field missing from Supabase schema
   - `SubmissionAttachment` table completely missing from Supabase

2. **Inconsistent Materialized Views**:
   - Different column selections (cohort field, column aliases)
   - Different filtering logic for 30-day calculations
   - Different view names (activity_metrics vs metric_counts)

3. **Missing Business Logic**:
   - Amplify quota enforcement trigger missing in Supabase
   - Unique LEARN submission constraint missing in Supabase

4. **Broken Index Creation**:
   - Admin query indexes use incorrect table names (singular instead of plural)

5. **Duplicate/Conflicting Migrations**:
   - RLS policies duplicated across multiple files
   - Extension and auth functions duplicated

### Migration File Comparison

#### Prisma Migrations (4 files):
- `001_init.sql` - Core schema
- `002_views.sql` - Materialized views
- `003_constraints.sql` - Business constraints  
- `004_amplify_quota.sql` - Amplify quota trigger

#### Supabase Migrations (10 files):
- `20250902000001_initial_schema.sql` - Core schema (missing kajabi_contact_id, SubmissionAttachment)
- `20250902000002_materialized_views.sql` - Different view definitions
- `20250902000003_rls_policies.sql` - RLS policies
- `20250902000004_storage_setup.sql` - Storage configuration
- `00001_enable_rls.sql` - RLS setup (duplicates functionality)
- `00002_auth_policies.sql` - Auth policies  
- `00003_submission_policies.sql` - Submission policies
- `00004_points_policies.sql` - Points policies
- `20250903090000_add_core_indexes.sql` - Performance indexes
- `20250903100000_add_admin_query_indexes.sql` - **BROKEN** (wrong table names)

## Consolidation Strategy

### Phase 1: Establish Prisma as Single Source of Truth

1. **Archive Supabase migrations** to preserve history
2. **Generate clean Prisma migrations** from current schema
3. **Create consolidated Supabase migrations** that match Prisma exactly
4. **Add Supabase-specific extensions** (RLS, storage, auth)

### Phase 2: Schema Synchronization

1. **Add missing fields**:
   - `kajabi_contact_id` to users table
   - Complete `submission_attachments` table

2. **Harmonize materialized views**:
   - Use Prisma version as canonical
   - Maintain consistent column naming and filtering

3. **Add missing business logic**:
   - Amplify quota trigger
   - LEARN submission uniqueness constraint

4. **Fix broken migrations**:
   - Correct table names in admin index migration

### Phase 3: Deployment Safety

1. **Create backup strategy**
2. **Implement rollback procedures**  
3. **Test migrations in staging**
4. **Verify data consistency**

## Implementation Plan

### Step 1: Fix Immediate Issues
- Fix broken admin index migration with correct table names
- Add missing kajabi_contact_id column
- Create submission_attachments table

### Step 2: Business Logic Synchronization
- Add amplify quota trigger
- Add LEARN submission constraint

### Step 3: View Harmonization  
- Drop and recreate materialized views with Prisma definitions
- Update refresh functions

### Step 4: Clean Architecture
- Create new consolidated migration structure
- Archive old conflicting migrations
- Document new single-source-of-truth process

## Risk Mitigation

1. **Data Loss Prevention**:
   - All operations are additive (no data drops)
   - FK constraints prevent orphaned records
   - Backup before major changes

2. **Deployment Failure Prevention**:
   - Idempotent operations where possible
   - Transaction boundaries for complex changes
   - Rollback scripts for each step

3. **Application Compatibility**:
   - No breaking changes to existing API
   - Graceful handling of new fields
   - Backward compatibility maintained