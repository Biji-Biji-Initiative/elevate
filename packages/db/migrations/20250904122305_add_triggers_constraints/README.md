# Migration: Add Triggers & Constraints

**Migration ID**: `20250904122305_add_triggers_constraints`  
**Created**: 2025-09-04  
**Purpose**: Add comprehensive triggers and constraints for data integrity, security, and business rule enforcement

## Overview

This migration implements a comprehensive set of triggers and constraints to enhance the MS Elevate LEAPS Tracker database with:

1. **Row-Level Security (RLS) policies** for multi-tenant preparation
2. **Business rule check constraints** for data validation
3. **Audit triggers** for sensitive operations tracking
4. **Data validation triggers** for format and uniqueness checks
5. **Performance and anti-gaming triggers** for system protection
6. **Business logic validation** for proper workflow enforcement

## Key Features Added

### 1. Row-Level Security (RLS) Policies

Prepares the database for future multi-tenant support while maintaining current functionality:

- **Users**: Participants can see public profiles, manage their own data
- **Submissions**: Public submissions visible to all, users see their own, reviewers see all
- **Points Ledger**: Users see their own points, reviewers/admins see all
- **Audit Log**: Only admins can read, system can insert
- **Attachments**: Follow submission visibility rules

### 2. Business Rule Check Constraints

Enforces critical business rules at the database level:

- **Points bounds**: -1000 to 1000 per transaction
- **Handle format**: 3-30 alphanumeric characters, hyphens, underscores
- **Email format**: Basic email pattern validation
- **AMPLIFY payload**: Required fields and value bounds (≤50 peers, ≤200 students)
- **PRESENT payload**: LinkedIn URL required and validated
- **LEARN payload**: Certificate name required

### 3. Audit Triggers

Comprehensive audit logging for sensitive operations:

- **User role changes**: Tracked with before/after values
- **Points adjustments**: All point ledger changes logged
- **Submission status changes**: Approval/rejection decisions tracked

### 4. Data Validation Triggers

Advanced validation beyond basic constraints:

- **Certificate hash uniqueness**: Prevents duplicate certificate submissions
- **URL validation**: Validates LinkedIn URLs and other submission URLs
- **Email normalization**: Converts emails to lowercase, validates length

### 5. Performance & Anti-Gaming Triggers

Protects system integrity and performance:

- **Submission rate limiting**: Max 10 submissions per hour per user
- **Single-attempt enforcement**: LEARN activity allows only one approved submission
- **Analytics refresh notifications**: Async refresh without blocking transactions

### 6. Business Logic Validation

Enforces proper workflow and permissions:

- **Status transition validation**: Prevents invalid submission status changes
- **Role change validation**: Protects against unauthorized role changes
- **Reviewer assignment**: Ensures reviewer is assigned when approving/rejecting

## Security Considerations

### RLS Policies
- All policies use `current_setting('app.user_id')` and `current_setting('app.user_role')` 
- Application must set these values using `SET LOCAL` in transactions
- Policies are permissive by default but can be restricted for multi-tenancy

### Audit Trail
- All sensitive operations are logged to `audit_log` table
- Actor identification via application-set user context
- Immutable audit records for compliance

### Anti-Gaming Measures
- Rate limiting prevents submission spam
- Certificate hash checking prevents duplicate submissions
- AMPLIFY quota validation prevents gaming the peer/student training system

## Performance Impact

### Positive Impacts
- Async analytics refresh via notifications (no blocking)
- Optimized indexes for common trigger queries
- Materialized views remain performant with proper refresh timing

### Considerations
- Additional validation overhead on INSERT/UPDATE operations
- Audit logging adds minimal overhead (single INSERT per audited operation)
- RLS policies add query overhead but can be optimized with proper indexes

## Migration Safety

### Backward Compatibility
- All constraints use `IF NOT EXISTS` where applicable
- Triggers replace existing ones safely with `DROP TRIGGER IF EXISTS`
- RLS policies are additive and don't break existing queries

### Rollback Support
- Complete rollback script provided (`rollback.sql`)
- All changes can be safely reverted
- Original functionality preserved

## Usage Instructions

### Application Integration

1. **Set User Context**: Before each transaction, set:
```sql
SET LOCAL app.user_id = 'user-id-here';
SET LOCAL app.user_role = 'PARTICIPANT'; -- or REVIEWER, ADMIN, SUPERADMIN
```

2. **Handle RLS**: Queries will automatically respect RLS policies based on user context

3. **Listen for Analytics Refresh**: Subscribe to PostgreSQL notifications:
```sql
LISTEN refresh_analytics;
```

### Monitoring

- **Audit logs**: Query `audit_log` table for security monitoring
- **Constraint violations**: Monitor application logs for constraint errors
- **Performance**: Watch for increased query times due to RLS/triggers

## Error Handling

### Common Error Codes
- `23514`: Check constraint violation (business rules)
- `23505`: Unique constraint violation (duplicates)
- `42501`: Insufficient permissions (RLS/role checks)
- `23502`: Not null violation (required fields)

### Example Error Messages
- `"Peer training limit exceeded (7-day total X + new Y > 50)"`
- `"Certificate hash already exists for another approved LEARN submission"`
- `"Submission rate limit exceeded (max 10 per hour)"`
- `"Cannot change status from APPROVED to REJECTED"`

## Testing Recommendations

1. **Unit Tests**: Test each trigger function independently
2. **Integration Tests**: Test full submission workflow with constraints
3. **Performance Tests**: Measure query performance with RLS enabled
4. **Security Tests**: Verify RLS policies prevent unauthorized access

## Future Enhancements

### Multi-Tenant Preparation
- RLS policies can be enhanced to filter by organization/tenant
- Additional context variables can be added for tenant identification

### Advanced Validation
- JSON schema validation for submission payloads
- More sophisticated URL validation
- Integration with external certificate verification

### Performance Optimization
- Conditional trigger execution based on changed columns
- Bulk operation optimization for admin actions
- Caching for frequently accessed RLS checks

## Related Documentation

- **Main Project Docs**: `/Users/agent-g/elevate/CLAUDE.md`
- **Database Schema**: `/Users/agent-g/elevate/elevate/packages/db/schema.prisma`
- **Previous Migrations**: `/Users/agent-g/elevate/elevate/packages/db/migrations/`

## Support

For issues related to this migration:

1. Check constraint error messages for specific business rule violations
2. Verify application sets proper user context (`app.user_id`, `app.user_role`)
3. Monitor `audit_log` table for debugging security issues
4. Use rollback script if immediate reversion is needed

This migration significantly enhances the database's robustness, security, and business rule enforcement while maintaining backward compatibility and performance.