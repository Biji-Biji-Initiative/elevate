# Referral System Validation Checklist

This checklist helps validate the referral system implementation locally after applying the database migrations.

## Prerequisites

- Docker running with `elevate-postgres` container
- Local development environment set up
- Access to both web and admin applications

## Step 1: Apply Database Migrations

```bash
# From repo root
chmod +x scripts/db/apply-referrals-local.sh
./scripts/db/apply-referrals-local.sh
```

**Expected Output:**

- ✅ Container started successfully
- ✅ Database is ready
- ✅ Referral support migration applied
- ✅ User type confirmation migration applied
- ✅ All referral migrations applied successfully

## Step 2: Regenerate Prisma Client

```bash
pnpm -C elevate -F @elevate/db prisma generate
```

**Expected Output:**

- Prisma client regenerated successfully
- No TypeScript errors

## Step 3: (Optional) Rebuild OpenAPI Package

```bash
pnpm -C elevate -F @elevate/openapi build
```

**Expected Output:**

- OpenAPI package built successfully
- SDK includes new referral endpoints

## Step 4: Start Applications

```bash
# Terminal 1 - Web app
pnpm -C elevate dev:web

# Terminal 2 - Admin app
pnpm -C elevate dev:admin
```

**Expected Output:**

- Both applications start without errors
- No database connection issues
- All endpoints accessible

## Step 5: Test Referral Link Generation

### 5.1 Access Referral Link Endpoint

**URL:** `GET /api/referrals/link`

**Authentication:** Required (Clerk JWT)

**Test Steps:**

1. Sign in to the web application
2. Navigate to `/dashboard/amplify/invite` (or call API directly)
3. Copy the generated referral link

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "refCode": "ABC123XY",
    "link": "http://localhost:3000/?ref=ABC123XY"
  }
}
```

**Validation Points:**

- ✅ Link contains unique ref_code
- ✅ Link uses correct base URL
- ✅ ref_code is 8 characters, alphanumeric
- ✅ No duplicate ref_codes generated

## Step 6: Test Referral Flow End-to-End

### 6.1 Test Referral Signup Flow

**Test Steps:**

1. Open referral link in incognito/private browser window
2. Verify auto-redirect to sign-up page with `?ref=` parameter
3. Complete user registration
4. Complete onboarding and select user type (educator/student)
5. Verify redirect to dashboard

**Expected Behavior:**

- ✅ Referral parameter preserved through signup flow
- ✅ User type selection required for new users
- ✅ Successful redirect to dashboard after onboarding
- ✅ Referral event created in database

### 6.2 Verify Referral Event Creation

**Database Check:**

```sql
-- Check referral_events table
SELECT * FROM referral_events ORDER BY created_at DESC LIMIT 5;

-- Check user referral relationships
SELECT
  u1.email as referrer_email,
  u2.email as referee_email,
  re.event_type,
  re.created_at
FROM referral_events re
JOIN users u1 ON re.referrer_user_id = u1.id
JOIN users u2 ON re.referee_user_id = u2.id
ORDER BY re.created_at DESC;
```

**Expected Results:**

- ✅ referral_events table contains new entries
- ✅ referrer_user_id and referee_user_id properly linked
- ✅ event_type set to appropriate value (e.g., "signup")
- ✅ created_at timestamp recorded

## Step 7: Test Admin Referral Management

### 7.1 Access Admin Referrals Endpoint

**URL:** `GET /api/admin/referrals`

**Authentication:** Required (Admin role)

**Test Steps:**

1. Sign in to admin application with admin role
2. Navigate to `/admin/referrals` or call API directly
3. Test various filter parameters

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": "evt_123",
        "eventType": "signup",
        "source": "referral_link",
        "createdAt": "2024-01-15T10:30:00Z",
        "referrer": {
          "id": "user_123",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "referee": {
          "id": "user_456",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "userType": "educator"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "pages": 1
    }
  }
}
```

### 7.2 Test Admin Filtering

**Test Cases:**

1. **Email Filter:** `?email=john@example.com`
2. **Month Filter:** `?month=2024-01`
3. **Referrer Filter:** `?referrerId=user_123`
4. **Pagination:** `?limit=10&offset=0`

**Expected Results:**

- ✅ Email filter returns referrals where user is referrer OR referee
- ✅ Month filter returns referrals within specified month
- ✅ Referrer filter returns referrals by specific referrer
- ✅ Pagination works correctly with limit/offset

## Step 8: Test Points Award System

### 8.1 Verify Referral Points Logic

**Expected Points:**

- Educator referral: +2 points
- Student referral: +1 point
- Monthly cap: 50 points per referrer per month

**Test Steps:**

1. Create multiple referrals (mix of educators/students)
2. Check points ledger for referrer
3. Verify monthly cap enforcement

**Database Check:**

```sql
-- Check points ledger for referral points
SELECT
  pl.user_id,
  pl.activity_code,
  pl.delta_points,
  pl.source,
  pl.created_at
FROM points_ledger pl
WHERE pl.activity_code = 'referral'
ORDER BY pl.created_at DESC;
```

**Expected Results:**

- ✅ Referral points awarded correctly (+1 for students, +2 for educators)
- ✅ Monthly cap enforced (max 50 points per month)
- ✅ Points ledger entries created with proper source

## Step 9: Test Error Handling

### 9.1 Unauthorized Access

**Test Cases:**

1. Call `/api/referrals/link` without authentication
2. Call `/api/admin/referrals` without admin role

**Expected Results:**

- ✅ Returns 401 Unauthorized for missing auth
- ✅ Returns 403 Forbidden for insufficient permissions

### 9.2 Invalid Parameters

**Test Cases:**

1. Admin referrals with invalid month format: `?month=2024-13`
2. Admin referrals with invalid email: `?email=invalid-email`

**Expected Results:**

- ✅ Returns 400 Bad Request with validation errors
- ✅ Proper error messages returned

## Step 10: Performance Validation

### 10.1 Database Performance

**Test Cases:**

1. Generate referral link (should be fast)
2. Query admin referrals with filters (should be fast)
3. Create multiple referrals in sequence

**Expected Results:**

- ✅ Referral link generation < 200ms
- ✅ Admin queries < 500ms even with filters
- ✅ No database locks or timeouts

## Troubleshooting

### Common Issues

1. **Container Not Found**

   ```bash
   # Check container name
   docker ps -a | grep postgres

   # Override container name
   CONTAINER_NAME=your_container_name ./scripts/db/apply-referrals-local.sh
   ```

2. **Database Connection Issues**

   ```bash
   # Check if container is running
   docker ps | grep postgres

   # Check database connectivity
   docker exec elevate-postgres pg_isready -U postgres -d elevate_leaps
   ```

3. **Prisma Client Issues**

   ```bash
   # Regenerate client
   pnpm -C elevate -F @elevate/db prisma generate

   # Check for TypeScript errors
   pnpm -C elevate typecheck
   ```

4. **Missing Referral Events**
   - Verify referral parameter preserved in signup flow
   - Check referral event creation logic
   - Verify database constraints (unique indexes)

### Validation Success Criteria

- ✅ All migrations applied successfully
- ✅ Referral links generated and functional
- ✅ End-to-end referral flow works
- ✅ Admin can view and filter referrals
- ✅ Points awarded correctly with caps
- ✅ Error handling works properly
- ✅ Performance meets requirements

## Next Steps

After successful validation:

1. **Deploy to staging** for team testing
2. **Monitor referral metrics** in production
3. **Set up alerts** for referral system health
4. **Document user-facing referral features** for educators

---

**Last Updated:** January 2024  
**Version:** 1.0  
**Maintainer:** Development Team
