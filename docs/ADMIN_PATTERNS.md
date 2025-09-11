# Admin Patterns (Server-First)

This is a quick-start for contributors adding new Admin flows. The Admin app uses server-only services, Zod-validated DTOs, and centralized mappers.

- Authorize at service boundaries (`requireRole('admin'|'reviewer')`).
- Parse inputs once with Zod; do not pass `any` through.
- Map database rows to Admin DTOs via `apps/admin/lib/server/mappers.ts`.
- Avoid intra-app `fetch` — call services directly from server actions/SSR.
- Add lightweight observability: safe logs and SLO timings on key operations.

## Template: Service

```ts
"use server"
import 'server-only'
import { requireRole } from '@elevate/auth/server-helpers'
import { prisma } from '@elevate/db'
import { z } from 'zod'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { sloMonitor } from '@elevate/logging/slo-monitor'
import { toSomething } from '@/lib/server/mappers'

const InputSchema = z.object({ id: z.string() })

export async function doSomethingService(body: unknown) {
  await requireRole('admin')
  const start = Date.now()
  const { id } = InputSchema.parse(body)

  const row = await prisma.something.findUnique({ where: { id } })
  if (!row) throw new Error('Not found')

  const dto = toSomething(row)

  const log = await getSafeServerLogger('admin-something')
  log.info('Did something', { id })
  sloMonitor.recordApiAvailability('/admin/service/something/do', 'SERVICE', 200)
  sloMonitor.recordApiResponseTime('/admin/service/something/do', 'SERVICE', Date.now() - start, 200)

  return { message: 'ok', data: dto }
}
```

## Template: Mapper

```ts
// apps/admin/lib/server/mappers.ts
import { SomeDtoSchema, type SomeDto } from '@elevate/types/admin-api-types'

export function toSomething(row: { id: string; created_at: Date; name: string | null }): SomeDto {
  const dto = { id: row.id, created_at: row.created_at.toISOString(), name: row.name ?? '' }
  return SomeDtoSchema.parse(dto)
}
```

## Template: Server Action (thin)

```ts
'use server'
import { doSomethingService } from '@/lib/server/something-service'

export async function doSomethingAction(body: unknown) {
  return doSomethingService(body)
}
```

## Tips

- Use minimal structural row types in mappers to avoid coupling to Prisma types.
- Normalize dates to ISO strings; default optional fields sanely.
- If adding analytics, validate the final response envelope with the Zod schema (`AnalyticsResponseSchema`).
- Prefer `getSafeServerLogger` for logs in services/actions; never import `@elevate/logging/server` in route handlers.

## Error Codes (AdminError)

Use `AdminError` for predictable error handling across services. Suggested codes:

- `VALIDATION_ERROR`: invalid or missing input (e.g., missing `badgeCode`).
- `NOT_FOUND`: entities not found (e.g., badge, user, assignments).
- `DUPLICATE`: unique conflict (e.g., badge code already exists).
- `CONFLICT`: state conflicts (e.g., cannot delete earned badge; already has badge).
- `INTEGRATION_FAILED`: upstream API failure (e.g., Kajabi request failed).
- `UNAUTHORIZED`/`FORBIDDEN`: auth or role checks failed (usually enforced via `requireRole`).
- `INTERNAL`: unexpected errors.

Patterns:
- Throw `new AdminError(code, message, meta?)` at service boundaries when a known condition occurs.
- Otherwise, `handleApiError(err, context)` to create a safe message; log details with `getSafeServerLogger`.
