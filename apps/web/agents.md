# Agents Guide — Elevate Web App (Public)

Purpose: Give agents precise, local rules for working in the public Web app.

## Scope & Principles
- Service layer first: Use functions from `@elevate/db` or other packages — do not import Prisma client directly in app routes.
- DTO mapping: Convert raw results via DTO mappers from `@elevate/types` (e.g., `mapRawUserProfileToDTO`) before returning JSON.
- HTTP helpers: Wrap handlers with `@elevate/http` `withErrorHandling`, and return `createSuccessResponse` / `createErrorResponse`.
- Import hygiene: Keep import groups orderly and consistent (see below).

## Do
- Validate params/body with zod schemas from `@elevate/types` (or local schemas where appropriate).
- Use the service/API layer from packages (e.g., `@elevate/db`, `@elevate/integrations`) — no direct Prisma in `apps/web`.
- Return typed DTOs from `@elevate/types` mappers where available.
- Use SLO logging where it exists: `recordApiAvailability/recordApiResponseTime` from `@elevate/logging/slo-monitor`.

## Don’t
- Don’t import `@prisma/client` or `@elevate/db/client` directly in the Web app.
- Don’t put imports in the body of modules; keep them at the top.
- Don’t return raw database objects without mapping to DTOs where the public API expects DTO shape.

## Import Order (eslint: import/order)
1) External framework libs: `react`, `next/*`, `next-intl`, `zod`
2) Internal libs: `@elevate/*` packages (http, logging, types, db, etc.)
3) Local module imports
- Exactly one blank line between groups; no blank lines within a group.
- Avoid duplicate imports / imports in module body.

## Common Route Pattern
```ts
import type { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling, createSuccessResponse, createErrorResponse } from '@elevate/http'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { SomeSchema } from '@elevate/types'
import { doSomething } from '@elevate/db'

export const runtime = 'nodejs'

export const GET = withErrorHandling(async (req: NextRequest): Promise<NextResponse> => {
  const start = Date.now()
  try {
    // validate
    const parsed = SomeSchema.safeParse({})
    if (!parsed.success) return createErrorResponse(new Error('Bad request'), 400)

    // service call
    const data = await doSomething()

    // success
    recordApiAvailability('/api/example', 'GET', 200)
    recordApiResponseTime('/api/example', 'GET', Date.now() - start, 200)
    return createSuccessResponse(data)
  } catch (_err) {
    // error
    recordApiAvailability('/api/example', 'GET', 500)
    recordApiResponseTime('/api/example', 'GET', Date.now() - start, 500)
    return createErrorResponse(new Error('Internal error'), 500)
  }
})
```

## Local Commands
- Install: `pnpm -C elevate install`
- Dev (web only): `pnpm -C elevate -F web dev`
- Lint (web only): `pnpm -C elevate -F web lint`
- Type-check: `pnpm -C elevate -F web type-check`
- Monorepo lint: `pnpm -C elevate lint`

## Notes
- Favor server components and route handlers for data fetching.
- Keep routes small and composable using the shared helpers and service layer.
