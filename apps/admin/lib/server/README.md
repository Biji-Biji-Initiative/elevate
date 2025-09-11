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

## Testing

- Unit tests for mappers live under `apps/admin/__tests__`:
  - `mappers.test.ts`: submission, badge, user, referrals, kajabi
  - `analytics-shapes.test.ts`: validates distributions, trends, overview, and recent/performance shapes

This keeps DTO shapes consistent and DX-friendly while retaining strong runtime guarantees.
