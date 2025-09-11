# Admin Server Actions

Thin wrappers around server-only services. Guiding principles:

- Keep actions minimal: parse inputs if needed, then call `apps/admin/lib/server/*-service.ts`.
- Do not perform DB/query logic in actions — keep it in services.
- Do not use `fetch` between admin modules; call services directly.
- Return DTOs from services; actions simply relay them.

Example:

```ts
'use server'
import 'server-only'
import { listUsersService } from '@/lib/server/users-service'

export async function listUsersAction(params: unknown) {
  // Optionally validate in the action, or pass through to service which validates
  return listUsersService(params as any)
}
```

See also `docs/ADMIN_PATTERNS.md` for full templates.

