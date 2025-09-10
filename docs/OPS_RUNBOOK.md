# Ops Runbook — MS Elevate LEAPS

This runbook summarizes critical operational settings and admin actions.

## Environment Variables

- Kajabi
  - `KAJABI_API_KEY` (required)
  - `KAJABI_CLIENT_SECRET` (required)
  - `KAJABI_OFFER_ID` (optional; used to grant an offer on enrollment)
- Internal APIs
  - `ENABLE_INTERNAL_ENDPOINTS=1` to enable `/api/slo`
  - `INTERNAL_METRICS_TOKEN=<random>`; call with `Authorization: Bearer <token>`
- Cron
  - `CRON_SECRET=<random>`; Vercel/cron jobs must send `Authorization: Bearer <secret>`
- Storage (Supabase)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `AV_SCAN_ENABLED=true` to enable EICAR-based heuristic; replace with a real AV integration in production

## Admin Endpoints

- Kajabi Health
  - `GET /api/admin/kajabi/health` → `{ healthy, hasKey, hasSecret }`
- Kajabi Invite
  - `POST /api/admin/kajabi/invite` with body `{ userId? | email?, name?, offerId? }`
- Storage Retention (per-user)
  - `POST /api/admin/storage/retention` with body `{ userId, days?=730 }`
- Retention Cron (batch)
  - `GET /api/cron/enforce-retention?days=730&limit=200&offset=0` (auth via `CRON_SECRET`)

## Operational Playbook

- Onboarding
  1. Confirm Kajabi credentials and (optionally) `KAJABI_OFFER_ID`.
  2. Verify health via `GET /api/admin/kajabi/health`.
  3. For specific users, use `POST /api/admin/kajabi/invite`.
- Evidence Storage
  1. Ensure Supabase config present.
  2. Keep `AV_SCAN_ENABLED=true` until a real AV scanner is wired.
  3. Retention: schedule Vercel cron to call `/api/cron/enforce-retention` daily.
- SLO Monitoring
  1. Enable `/api/slo` in non-public environments; retrieve summary with the token.
  2. Extend SLO instrumentation to high-value routes (webhook, approvals).

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browsers; `@elevate/storage` is server-only.
- Keep cron/metrics tokens secret; restrict access to internal monitoring endpoints.
