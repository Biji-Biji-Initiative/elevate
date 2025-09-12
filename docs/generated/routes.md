# Route Documentation
Generated: Fri Sep 12 11:19:16 UTC 2025

This document provides a comprehensive overview of all routes in the MS Elevate LEAPS Tracker applications.

## Web Application Routes

### Page Routes
- `/[locale]/account/page.tsx` - apps/web/app/[locale]/account/page.tsx
- `/[locale]/dashboard/amplify/invite/page.tsx` - apps/web/app/[locale]/dashboard/amplify/invite/page.tsx
- `/[locale]/dashboard/amplify/page.tsx` - apps/web/app/[locale]/dashboard/amplify/page.tsx
- `/[locale]/dashboard/explore/page.tsx` - apps/web/app/[locale]/dashboard/explore/page.tsx
- `/[locale]/dashboard/page.tsx` - apps/web/app/[locale]/dashboard/page.tsx
- `/[locale]/dashboard/present/page.tsx` - apps/web/app/[locale]/dashboard/present/page.tsx
- `/[locale]/dashboard/shine/page.tsx` - apps/web/app/[locale]/dashboard/shine/page.tsx
- `/[locale]/educators-only/page.tsx` - apps/web/app/[locale]/educators-only/page.tsx
- `/[locale]/leaderboard/page.tsx` - apps/web/app/[locale]/leaderboard/page.tsx
- `/[locale]/metrics/[stage]/page.tsx` - apps/web/app/[locale]/metrics/[stage]/page.tsx
- `/[locale]/onboarding/user-type/page.tsx` - apps/web/app/[locale]/onboarding/user-type/page.tsx
- `/[locale]/page.tsx` - apps/web/app/[locale]/page.tsx
- `/[locale]/sign-up/page.tsx` - apps/web/app/[locale]/sign-up/page.tsx
- `/[locale]/u/[handle]/page.tsx` - apps/web/app/[locale]/u/[handle]/page.tsx
- `/[locale]/u/profile/page.tsx` - apps/web/app/[locale]/u/profile/page.tsx
- `/docs/page.tsx` - apps/web/app/docs/page.tsx
- `/page.tsx` - apps/web/app/page.tsx

### API Routes
- `/api/admin/performance/materialized-views` - apps/web/app/api/admin/performance/materialized-views/route.ts
- `/api/admin/test/materialized-views` - apps/web/app/api/admin/test/materialized-views/route.ts
- `/api/badges` - apps/web/app/api/badges/route.ts
- `/api/cron/enforce-retention` - apps/web/app/api/cron/enforce-retention/route.ts
- `/api/cron/refresh-leaderboards` - apps/web/app/api/cron/refresh-leaderboards/route.ts
- `/api/csp-report` - apps/web/app/api/csp-report/route.ts
- `/api/csrf-token` - apps/web/app/api/csrf-token/route.ts
- `/api/dashboard` - apps/web/app/api/dashboard/route.ts
- `/api/docs` - apps/web/app/api/docs/route.ts
- `/api/emails/approval` - apps/web/app/api/emails/approval/route.ts
- `/api/emails/rejection` - apps/web/app/api/emails/rejection/route.ts
- `/api/emails/submission-confirmation` - apps/web/app/api/emails/submission-confirmation/route.ts
- `/api/emails/welcome` - apps/web/app/api/emails/welcome/route.ts
- `/api/files/[...path]` - apps/web/app/api/files/[...path]/route.ts
- `/api/files/upload` - apps/web/app/api/files/upload/route.ts
- `/api/health` - apps/web/app/api/health/route.ts
- `/api/kajabi/webhook` - apps/web/app/api/kajabi/webhook/route.ts
- `/api/leaderboard` - apps/web/app/api/leaderboard/route.ts
- `/api/logs/client-errors` - apps/web/app/api/logs/client-errors/route.ts
- `/api/metrics` - apps/web/app/api/metrics/route.ts
- `/api/performance-benchmark` - apps/web/app/api/performance-benchmark/route.ts
- `/api/profile/[handle]` - apps/web/app/api/profile/[handle]/route.ts
- `/api/profile/me` - apps/web/app/api/profile/me/route.ts
- `/api/profile/onboarding` - apps/web/app/api/profile/onboarding/route.ts
- `/api/profile/user-type` - apps/web/app/api/profile/user-type/route.ts
- `/api/referrals/link` - apps/web/app/api/referrals/link/route.ts
- `/api/schools` - apps/web/app/api/schools/route.ts
- `/api/slo` - apps/web/app/api/slo/route.ts
- `/api/stats-optimized` - apps/web/app/api/stats-optimized/route.ts
- `/api/stats` - apps/web/app/api/stats/route.ts
- `/api/stories` - apps/web/app/api/stories/route.ts
- `/api/submissions` - apps/web/app/api/submissions/route.ts
- `/api/test-db` - apps/web/app/api/test-db/route.ts
- `/api/webhooks/clerk` - apps/web/app/api/webhooks/clerk/route.ts

### Special Files
- layout - apps/web/app/[locale]/layout.tsx
- sitemap - apps/web/app/[locale]/sitemap.ts
- layout - apps/web/app/layout.tsx

## Admin Application Routes

### Page Routes
- `/[locale]/audit/page.tsx` - apps/admin/app/[locale]/audit/page.tsx
- `/[locale]/badges/page.tsx` - apps/admin/app/[locale]/badges/page.tsx
- `/[locale]/exports/page.tsx` - apps/admin/app/[locale]/exports/page.tsx
- `/[locale]/kajabi/page.tsx` - apps/admin/app/[locale]/kajabi/page.tsx
- `/[locale]/ops/page.tsx` - apps/admin/app/[locale]/ops/page.tsx
- `/[locale]/page.tsx` - apps/admin/app/[locale]/page.tsx
- `/[locale]/queue/page.tsx` - apps/admin/app/[locale]/queue/page.tsx
- `/[locale]/referrals/page.tsx` - apps/admin/app/[locale]/referrals/page.tsx
- `/[locale]/review/[id]/page.tsx` - apps/admin/app/[locale]/review/[id]/page.tsx
- `/[locale]/storage/page.tsx` - apps/admin/app/[locale]/storage/page.tsx
- `/[locale]/submissions/page.tsx` - apps/admin/app/[locale]/submissions/page.tsx
- `/[locale]/unauthorized/page.tsx` - apps/admin/app/[locale]/unauthorized/page.tsx
- `/[locale]/users/[id]/page.tsx` - apps/admin/app/[locale]/users/[id]/page.tsx
- `/[locale]/users/page.tsx` - apps/admin/app/[locale]/users/page.tsx
- `/page.tsx` - apps/admin/app/page.tsx

### API Routes
- `/api/admin/analytics-optimized` - apps/admin/app/api/admin/analytics-optimized/route.ts
- `/api/admin/analytics` - apps/admin/app/api/admin/analytics/route.ts
- `/api/admin/audit/export.csv` - apps/admin/app/api/admin/audit/export.csv/route.ts
- `/api/admin/audit` - apps/admin/app/api/admin/audit/route.ts
- `/api/admin/badges/assign` - apps/admin/app/api/admin/badges/assign/route.ts
- `/api/admin/badges` - apps/admin/app/api/admin/badges/route.ts
- `/api/admin/exports` - apps/admin/app/api/admin/exports/route.ts
- `/api/admin/kajabi/health` - apps/admin/app/api/admin/kajabi/health/route.ts
- `/api/admin/kajabi/invite` - apps/admin/app/api/admin/kajabi/invite/route.ts
- `/api/admin/kajabi/reprocess` - apps/admin/app/api/admin/kajabi/reprocess/route.ts
- `/api/admin/kajabi` - apps/admin/app/api/admin/kajabi/route.ts
- `/api/admin/kajabi/test` - apps/admin/app/api/admin/kajabi/test/route.ts
- `/api/admin/meta/cohorts` - apps/admin/app/api/admin/meta/cohorts/route.ts
- `/api/admin/meta/rate-limits` - apps/admin/app/api/admin/meta/rate-limits/route.ts
- `/api/admin/referrals/export.csv` - apps/admin/app/api/admin/referrals/export.csv/route.ts
- `/api/admin/referrals` - apps/admin/app/api/admin/referrals/route.ts
- `/api/admin/referrals/summary` - apps/admin/app/api/admin/referrals/summary/route.ts
- `/api/admin/slo/summary` - apps/admin/app/api/admin/slo/summary/route.ts
- `/api/admin/storage/retention` - apps/admin/app/api/admin/storage/retention/route.ts
- `/api/admin/submissions/[id]` - apps/admin/app/api/admin/submissions/[id]/route.ts
- `/api/admin/submissions` - apps/admin/app/api/admin/submissions/route.ts
- `/api/admin/users/[id]` - apps/admin/app/api/admin/users/[id]/route.ts
- `/api/admin/users/export.csv` - apps/admin/app/api/admin/users/export.csv/route.ts
- `/api/admin/users/leaps` - apps/admin/app/api/admin/users/leaps/route.ts
- `/api/admin/users` - apps/admin/app/api/admin/users/route.ts
- `/api/csp-report` - apps/admin/app/api/csp-report/route.ts

## Route Analysis

- **Total Routes**: 92
- **Sitemap Files**: 1
- **Last Updated**: Fri Sep 12 11:19:16 UTC 2025

---
*This documentation is automatically generated by the Route Conflict Detection workflow.*
