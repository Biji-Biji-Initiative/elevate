---
title: Development Troubleshooting & Patterns
owner: platform-team
status: active
last_reviewed: 2025-09-10
tags: [dev, turbopack, clerk, next-intl]
---

This note captures a few sharp edges we’ve hardened in development. It complements BUILDING.md (no changes to the build pipeline).

Clerk + Middleware
- Context init: If `auth()` is called downstream, ensure Clerk context is initialized in `middleware.ts` for non-static requests. We call `await auth()` early to avoid “auth()…can’t detect usage of clerkMiddleware()”. Pages still enforce auth via route logic.
- Matcher: Keep the matcher broad for pages and API; static/_next paths are excluded.

Next-Intl Provider Placement
- Admin: Provide `NextIntlClientProvider` in `app/layout.tsx` and do not re-wrap in `[locale]/layout.tsx`. Client hooks like `useTranslations` must render under that provider.
- Web: Locale layout already provides the provider; keep client components using `useTranslations` under `[locale]/layout.tsx`.

Turbopack & Tracing
- Root pin: Set `turbopack.root = __dirname` in each app to avoid Next inferring the workspace root when multiple lockfiles exist.
- Server tracing: Set `outputFileTracingRoot` to the monorepo root (two levels up from app) to ensure correct tracing in dev and build.

Admin Dev Port
- The admin app now selects the first free port starting at 3001. Override with `ADMIN_PORT` or `PORT`.
- Script: `apps/admin/scripts/dev.js` is used by `pnpm -C elevate dev` and forwards `--turbo`.

Profile API Route Cleanup
- `apps/web/app/api/profile/[handle]/route.ts` consolidated to the service-layer implementation (`@elevate/db` helpers). Avoid direct `prisma` usage in app routes.

Verification
- Type-check: `pnpm -C elevate type-check`.
- Lint (strict): `pnpm -C elevate lint:check` (0 warnings allowed). Use `lint:fix` to auto-fix ordering/newlines.

These patterns keep dev stable and prevent noisy runtime errors without changing the published package surface.

