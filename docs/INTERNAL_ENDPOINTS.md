# Internal Endpoints

Some endpoints are for internal diagnostics and performance validation only. They are gated by the environment variable `ENABLE_INTERNAL_ENDPOINTS=1` and should remain disabled in production unless explicitly needed.

## Endpoints

- `GET /api/slo`
- `GET /api/metrics`
- `GET /api/admin/performance/materialized-views`
- `GET /api/admin/test/materialized-views`
- `GET /api/performance-benchmark`

## Access Control

- All internal endpoints require `ENABLE_INTERNAL_ENDPOINTS=1` to respond.
- `/api/slo` and `/api/metrics` also require a bearer token:
  - `INTERNAL_METRICS_TOKEN` must be set in production (fail-closed).
  - Authorization: `Authorization: Bearer <token>`

## Notes

- These routes are not part of the public API contract and may change without notice.
- Prefer using monitoring integrations and dashboards in production environments.
