# Admin Guide — Operations & Integrations

This guide walks through using the Admin Console for Kajabi enrollment, evidence retention, and operational monitoring.

## Prerequisites

- Admin access (role: `admin` or `superadmin`).
- Environment configured:
  - `KAJABI_API_KEY`, `KAJABI_CLIENT_SECRET` (required); optional `KAJABI_OFFER_ID`
  - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET` for scheduled retention
  - Optional: `ENABLE_INTERNAL_ENDPOINTS=1`, `INTERNAL_METRICS_TOKEN` for `/api/slo`

## Kajabi Integration

- Navigate to `/{locale}/kajabi` in the Admin app.
- Health Check: Click "Check Kajabi Health" to verify API credentials and connectivity.
- Invite/Enroll:
  - Provide either a `User ID` or an `Email`.
  - Optionally include `Name` and `Offer ID` to override the default.
  - Click "Send Invite / Grant Offer". The system creates/updates the Kajabi contact, persists `kajabi_contact_id`, and grants the offer (if provided).

## Storage & Retention

- Navigate to `/{locale}/storage`.
- Enforce per-user retention:
  - Enter `User ID` and the number of `Days` (default 730), then click "Enforce".
- Schedule batch retention via Vercel Cron:
  - Ensure `CRON_SECRET` is set in Vercel.
  - Configure a cron calling:
    - `GET /api/cron/enforce-retention?days=730&limit=200&offset=0`
    - Header: `Authorization: Bearer ${CRON_SECRET}`

## Ops Dashboard (SLOs)

- Navigate to `/{locale}/ops` to view:
  - Total SLOs, healthy vs breaching, and per-SLO stats.
  - Click "Refresh" to fetch current summary.
- Extend SLO monitoring by instrumenting more routes using `recordApiAvailability` and `recordApiResponseTime`.

## Notes

- LEARN points come from Kajabi tags only; admin approvals do not award LEARN points.
- Dashboard points derive from the ledger (Option B); LEARN completion is based on tag grants.
- Starter badge requires both course completion tags.

## Manage LEAPS Profile Fields (Admin)

- Users list: `/{locale}/users` shows all users with search/filters.
- Per-user LEAPS management:
  - Click "Manage LEAPS" on a user row to edit LEAPS fields:
    - Role (Educator | Student)
    - Role confirmed (onboarding complete)
    - School
    - Region / Province
  - Changes update the database and mirror `user_type` to Clerk public metadata.
- API endpoints (admin-only):
  - `GET /api/admin/users/{id}` — Returns LEAPS fields for a single user.
  - `PATCH /api/admin/users/{id}` — Updates LEAPS fields; mirrors to Clerk.
  - `POST /api/admin/users/leaps` — Bulk update LEAPS fields for multiple users.

### Bulk LEAPS Update

- From Users page, select users and click "Update LEAPS".
- Choose LEAPS role (Educator/Student) and whether to mark role as confirmed.
- Confirms update for all selected users. Changes mirror to Clerk metadata.

## Referrals

- Navigate to `/{locale}/referrals`.
- Filter by email (referrer or referee), referrerId, refereeId, and month (YYYY-MM). Use month presets for quick selection.
- API: `GET /api/admin/referrals?email=&referrerId=&refereeId=&month=&limit=&offset=`
- Summary: `GET /api/admin/referrals/summary?month=YYYY-MM` returns totals, unique referrers, points awarded, and top referrers for the month.
- CSV Export: Client CSV export (current page) and Server Export (full dataset under current filters):
  - `GET /api/admin/referrals/export.csv?email=&referrerId=&refereeId=&month=`

## Audit Logs Viewer

- Route: `/{locale}/audit?targetId=<userId>&action=<action>&actorId=<actorId>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- Use case: Inspect recent admin actions for a specific user or endpoint.
- API: `GET /api/admin/audit?targetId=&action=&actorId=&startDate=&endDate=&page=&limit=`

## Clerk Dashboard Deep Link

- Add `NEXT_PUBLIC_CLERK_DASHBOARD_URL` in Admin `.env` to enable the “Open in Clerk” link in Users table.
- Example: `NEXT_PUBLIC_CLERK_DASHBOARD_URL=https://dashboard.clerk.com/apps/<your_app_id>`
