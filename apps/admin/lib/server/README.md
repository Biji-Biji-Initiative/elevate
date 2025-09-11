# Server-First Admin Architecture

This folder contains server-only services and mappers used by the Admin app. The goals:

- Directly invoke domain services on the server (no intra-app HTTP)
- Authorize at service boundaries (e.g., `requireRole('admin')`)
- Validate request/response with Zod at the boundary
- Convert Prisma rows to stable Admin DTOs via pure mappers

## Layout

- `mappers.ts`: Pure functions that convert minimal row shapes → Admin DTOs. Each mapper:
  - Accepts a minimal shape (keeps coupling to Prisma low)
  - Normalizes dates to ISO strings
  - Applies safe defaults for optional fields
  - Validates once at the boundary using the relevant Zod schema

- `*-service.ts`: Server-only services that:
  - Check authorization
  - Fetch rows via `@elevate/db`
  - Use mappers to construct DTOs
  - Return typed data used by server actions and SSR functions

## Patterns

- Keep services small and intention-revealing (fetch → map → return)
- Keep Zod validation at top/bottom edges (inputs/outputs), not mid-pipeline
- Don’t use HTTP `fetch` between Admin modules — call services directly
- Don’t export Prisma types from services; prefer minimal structural types in mappers

## Errors & Observability

- Use try/catch at service boundaries. On error:
  - Log with `getSafeServerLogger('<area>')` including key context fields.
  - Record SLO metrics using `recordSLO(routeKey, start, 500)` for failures.
  - Throw an `AdminError` (from `lib/server/admin-error.ts`) with a code like `NOT_FOUND`, `DUPLICATE`, `VALIDATION_ERROR`, etc.
  - For simple passthroughs, `handleApiError(err, context)` can produce a safe message.

- For success paths, call `recordSLO(routeKey, start, 200)`.

Helpers:
- `recordSLO(routeKey, start, status?)` in `lib/server/obs.ts`
- `AdminError`/`asAdminError` in `lib/server/admin-error.ts`

## Analytics Config

Points distribution buckets are configurable at runtime via environment variables:

- `ANALYTICS_POINTS_BUCKETS`: comma-separated integer thresholds, e.g. `0,50,100,200,500`.
  - Produces buckets like `0-49`, `50-99`, `100-199`, `200-499`, `500+`.
- `ANALYTICS_POINTS_QUANTILES`: integer number of quantiles (2–10). If set, overrides buckets.
  - Produces ranges labeled `Q1 (≤ X) ... Qn (+)` with even-count bins.

If no env is set, the default buckets are `0-49`, `50-99`, `100-199`, `200-499`, `500+`.

## Testing

- Unit tests for mappers live under `apps/admin/__tests__`:
  - `mappers.test.ts`: submission, badge, user, referrals, kajabi
  - `analytics-shapes.test.ts`: validates distributions, trends, overview, and recent/performance shapes

This keeps DTO shapes consistent and DX-friendly while retaining strong runtime guarantees.
