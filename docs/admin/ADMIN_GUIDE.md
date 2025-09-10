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
