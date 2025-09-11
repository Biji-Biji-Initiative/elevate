# Web App Internal Services Migration (No Intra‑App HTTP)

Goal: Remove intra‑app HTTP calls from the Web app’s server code (RSC/SSR/actions) and use server‑only services instead. Retain API routes and OpenAPI for public/CSR consumers.

Why

- Performance: Skip same‑origin HTTP and envelope parsing; faster SSR.
- Type safety: Use Zod/DTOs directly at service boundaries.
- Consistency: Align with Admin’s server‑only services approach.
- Auth/permissions: Centralize checks in services.
- Maintainability: One source of business logic; simpler tests.

Non‑Goals

- Do not remove public API routes or OpenAPI package (still used by docs and CSR/external clients).
- Do not refactor client‑side pages/components that intentionally fetch.

Scope & Plan

1. Profile (Public)
   - Service: `apps/web/lib/server/profile-service.ts` → `getPublicProfileByHandleService(handle)` uses `@elevate/db` + DTO mapper.
   - SSR: `app/[locale]/u/[handle]/page.tsx` now calls the service (no OpenAPI).

2. Stage Metrics (Public)
   - Service: `apps/web/lib/server/metrics-service.ts` → `getStageMetricsService(stage)` reuses DB queries + `buildStageMetricsDTO`.
   - SSR: `app/[locale]/metrics/[stage]/page.tsx` now calls the service (no OpenAPI).

3. Keep API routes
   - Routes under `apps/web/app/api/**` remain as public interfaces with rate‑limits and standard envelopes.
   - OpenAPI remains for docs/spec and any CSR/external consumers.

4. Client pages
   - Pages like Home/Leaderboard (client components) may continue to fetch from `/api/*` or use the SDK where appropriate.

5. Testing
   - SSR tests should target services directly.
   - API route tests remain unchanged to validate public contracts.

Follow‑ups

- Audit server components/actions for residual OpenAPI SDK usage and migrate similarly.
- Consider shared higher‑level services in `packages/*` if logic is duplicated between Web and Admin.
- Document caching strategy for services (e.g., RSC revalidate or cache layer) if needed.

