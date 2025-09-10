## Route Handler Patterns

Principles

- Use safe server logging that works in Next.js workers.
- Return consistent envelopes with `@elevate/http` helpers.
- Validate inputs aggressively (zod schemas, guards) and avoid `any`.
- Prefer DTO mappers for response shapes.
- Apply rate limiting where appropriate.

Logging

- Import `getSafeServerLogger` from `@elevate/logging/safe-server`.
- Initialize per-route and use `.forRequestWithHeaders(request)` when available.

```ts
const baseLogger = await getSafeServerLogger('route-name')
const logger = baseLogger.forRequestWithHeaders
  ? baseLogger.forRequestWithHeaders(request)
  : baseLogger
logger.info('context message', { key: 'value' })
```

Responses

- Use `createSuccessResponse(data)` and `createErrorResponse(err, status)` from `@elevate/http`.
- Keep error messages generic; include details in logs.

Validation

- Parse query and body with zod and domain schemas from `@elevate/types`.
- Add light type guards for Prisma error codes or third-party payloads.

Database access

- Import Prisma helpers and types from `@elevate/db` only; do not import `@prisma/client` in apps.
- Prefer service functions (`find*`, `count*`) and DTO mappers.

Caching

- Set explicit cache headers for GET endpoints.
- Add diagnostic headers (e.g., `X-...`) as needed.

Security

- Apply rate limiters from `@elevate/security`.
- Verify webhook signatures, timestamps, and deduplicate by unique keys.
