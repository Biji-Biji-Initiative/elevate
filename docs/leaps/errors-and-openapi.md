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

