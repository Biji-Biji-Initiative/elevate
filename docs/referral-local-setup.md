# Referral System - Local Setup Guide

Quick setup guide for running the referral system locally with Docker.

## Quick Start

```bash
# 1. Apply migrations
chmod +x scripts/db/apply-referrals-local.sh
./scripts/db/apply-referrals-local.sh

# 2. Regenerate Prisma client
pnpm -C elevate -F @elevate/db prisma generate

# 3. Start applications
pnpm -C elevate dev:web
pnpm -C elevate dev:admin
```

## What's Included

### Database Changes

- **Users table**: Added `ref_code` (unique) and `referred_by_user_id` columns
- **New table**: `referral_events` for tracking referral relationships
- **Users table**: Added `user_type_confirmed` boolean field

### API Endpoints

- **GET /api/referrals/link**: Generate referral link for authenticated user
- **GET /api/admin/referrals**: List referral events with filtering (admin only)

### Features

- **Referral links**: Unique 8-character codes for each user
- **Signup flow**: Auto-redirect to signup with referral parameter
- **Points system**: +2 for educator referrals, +1 for student referrals
- **Monthly caps**: 50 points per referrer per month
- **Admin visibility**: Full referral tracking and filtering

## Testing the Flow

1. **Get referral link**: Visit `/dashboard/amplify/invite` (authenticated)
2. **Test signup**: Open link in incognito → signup → choose role → dashboard
3. **Check admin**: Visit `/admin/referrals` to see referral events
4. **Verify points**: Check points ledger for referral bonuses

## Environment Variables

The script uses these defaults (override as needed):

- `CONTAINER_NAME=elevate-postgres`
- `DB_NAME=elevate_leaps`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`

Override example:

```bash
CONTAINER_NAME=my-postgres DB_NAME=my_db ./scripts/db/apply-referrals-local.sh
```

## Troubleshooting

**Container not found?**

```bash
docker ps -a | grep postgres
CONTAINER_NAME=your_container_name ./scripts/db/apply-referrals-local.sh
```

**Database not ready?**

```bash
docker exec elevate-postgres pg_isready -U postgres -d elevate_leaps
```

**Prisma errors?**

```bash
pnpm -C elevate -F @elevate/db prisma generate
```

## Validation

See [referral-validation-checklist.md](./referral-validation-checklist.md) for comprehensive testing steps.

---

**Ready to go!** 🚀
