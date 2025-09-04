# API Envelopes and Error Handling

This repository standardizes API responses across apps to keep clients simple and predictable.

## Success Responses

- Shape: `{ success: true, data: <payload> }`
- Use the helper: `createSuccessResponse(data, status?)` from `@elevate/types`.

Examples:

```ts
return createSuccessResponse({ items, pagination })
```

## Error Responses

- Shape: `{ success: false, error: string, details?, code?, traceId? }`
- Use the helper: `createErrorResponse(error, status?, traceId?)` from `@elevate/types`.
- Prefer domain errors (`ValidationError`, `AuthenticationError`, `AuthorizationError`) to set proper status codes.

Examples:

```ts
if (!parsed.success) return createErrorResponse(new Error('Invalid query'), 400)
```

## Rate Limiting

- Use `withRateLimit(request, limiter, handler)` from `@elevate/security` for API routes.
- Default limiters:
  - `adminRateLimiter` for admin endpoints
  - `apiRateLimiter` for general API endpoints
  - `webhookRateLimiter` for webhook endpoints

On block (429), response includes headers: `X-RateLimit-*` and `Retry-After`.

## Attachments (Canonical)

- Submissions store attachments in `submission_attachments` (relational).
- JSON `attachments` is removed from schema. APIs expose `attachmentCount` and, when required, `attachments_rel`.

## Validation and Sanitization

- Validate requests with zod schemas in `@elevate/types`.
- Prefer `withApiErrorHandling` and `validateRequest` helpers to keep handlers concise and safe.

