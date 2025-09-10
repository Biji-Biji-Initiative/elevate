# Staging Validation Checklist — MS Elevate LEAPS

This checklist verifies end-to-end functionality on staging before production deploy.

## 0) Environment sanity
- [ ] `DATABASE_URL` points to staging DB
- [ ] `KAJABI_API_KEY` / `KAJABI_CLIENT_SECRET` set and valid
- [ ] Optional `KAJABI_OFFER_ID` set if granting offer on enrollment
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `CRON_SECRET` configured (for retention)
- [ ] `ENABLE_INTERNAL_ENDPOINTS=1` and `INTERNAL_METRICS_TOKEN` (for `/api/slo`)

## 1) Sign up & basic flows
- [ ] Create a new user via Web app sign-up
- [ ] Confirm user appears in Admin > Users
- [ ] Visit Web dashboard; ensure no errors (200 OK)

## 2) Kajabi enrollment
- [ ] Admin → Kajabi page → click "Check Kajabi Health" → expect Healthy + API Key/Secret ✅
- [ ] Admin → Kajabi → Invite by Email (new user’s email) → expect success alert; audit log row created
- [ ] Confirm user `kajabi_contact_id` populated (via DB or Admin Users if surfaced)

## 3) LEARN tags (webhook/reprocess)
- [ ] Hit webhook with a valid tag payload for the user → expect event recorded; points ledger +10
- [ ] Repeat with second course tag → expect total +20 and Starter badge granted
- [ ] Reprocess unmatched event via Admin page if needed → expect status updated + points applied once

## 4) AMPLIFY submission & approval
- [ ] Submit AMPLIFY on Web with peers/students
- [ ] Admin approves submission → expect ledger ∆points = 2*peers + 1*students
- [ ] Dashboard points reflect ledger (Option B)

## 5) PRESENT submission & badge
- [ ] Submit PRESENT on Web; Admin approves → expect +20 points and Community Voice badge

## 6) Dashboard and leaderboard
- [ ] `/api/dashboard` returns ledger-derived points (AMPLY/LEARN reflect ledger)
- [ ] `/api/leaderboard` returns 200 OK with expected data

## 7) Retention (admin + cron)
- [ ] Admin → Storage page → enforce retention for test user with small `days` (e.g. 1) → expect success alert
- [ ] Cron: call `GET /api/cron/enforce-retention?days=730&limit=10&offset=0` with `Authorization: Bearer ${CRON_SECRET}` → expect 200 OK and JSON summary

## 8) SLOs
- [ ] Admin → Ops page shows SLO summary; no breaching SLOs under normal idle conditions
- [ ] Internal: `GET /api/slo` with token returns summary 200 OK

## 9) Security & headers spot-check
- [ ] Files API generates signed URLs with security headers; requires auth
- [ ] Admin endpoints return 401/403 for non-admins

## 10) Screenshots (attach in PR / issue)
- [ ] Admin → Kajabi page (Health check + Invite)
- [ ] Admin → Storage & Retention (form + success)
- [ ] Admin → Ops (SLO summary)
- [ ] Web → Dashboard points (Option B)
- [ ] Web → Leaderboard

---
Owner: Ops / QA
## Scripted checks (optional)

You can run a light validation script against staging endpoints:

```
BASE_URL=https://<staging-domain> \
ADMIN_TOKEN=<clerk-admin-jwt> \
INTERNAL_METRICS_TOKEN=<token> \
CRON_SECRET=<secret> \
pnpm -C elevate tsx scripts/qa/validate-staging.ts
```

The script probes public endpoints (`/api/health`, `/api/stats`, `/api/leaderboard`), optional internal SLO (`/api/slo`), admin endpoints (`/api/admin/kajabi/health`, `/api/admin/slo/summary`) when an admin token is provided, and retention cron behavior.
