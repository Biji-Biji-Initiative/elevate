# Error Contract and OpenAPI Examples

Error envelope

```ts
export type ApiError = {
  type: 'validation' | 'cap' | 'state' | 'auth' | 'idempotency'
  code: string
  message: string
  details?: Record<string, unknown>
}
```

Examples

- CAP_PEERS_7D: 422 with { priorPeers, peers, cap }
- DUPLICATE_SESSION_SUSPECT: 200 with warning flag in response
- UNMATCHED_CONTACT: 202 on webhook ingestion
- IDEMPOTENT_REPLAY: 200 with duplicate: true

OpenAPI

- Document error schemas and examples for each endpoint.
- Regenerate SDK after spec updates.

Tests

- Use Vitest (not Jest) for unit/property tests and race scenarios.

## HTTP mapping (canonical)

- validation → 400 (parse) or 422 (semantic)
- cap → 422
- state → 409
- auth → 401 (unauthenticated) / 403 (forbidden)
- idempotency → 200 with `{ duplicate: true }`

Include one example envelope per route (webhook, approval, stats) and regenerate the SDK after spec updates.
