# Ops & Reliability Playbook

Caching

- Stats: `Cache-Control: public, s-maxage=1800, stale-while-revalidate=60`

Evidence storage & serving

- Private bucket; uploads via server; signed URL TTL ≤ 1h for reviewers
- AV scan upon upload; reject infected files. The storage layer ships a stub scanner (EICAR heuristic) gated by `AV_SCAN_ENABLED=true` and a `scanFileBufferForVirus` hook for integration with a real scanner (e.g., ClamAV, Cloud AV). See `packages/storage/src/index.ts`.
- File type allow‑list (e.g., pdf, jpg, png, csv)
- Serve as attachment; disable inline PDF rendering; strip EXIF from thumbnails. The files API sets `Content-Disposition: attachment` and security headers.
- Retention: evidence 24 months; raw Kajabi 12 months (then anonymize)

Implementation notes

- Signed URLs: `getSignedUrl(path, 3600)` with TTL override support; multiple via `getMultipleSignedUrls`.
- Retention helper: `enforceUserRetention(userId, cutoff)` deletes objects older than cutoff under `evidence/<user>/<activity>`.
- Scheduled retention: `GET /api/cron/enforce-retention?days=730&limit=200&offset=0` (auth via `Authorization: Bearer $CRON_SECRET`) processes users in batches.
- Internal SLO summary: `GET /api/slo` gated by `ENABLE_INTERNAL_ENDPOINTS=1` and `INTERNAL_METRICS_TOKEN` header.

Indexes & performance

- points_ledger: (user_id, activity_code), (activity_code, external_source, event_time), (created_at)
- submissions: (user_id, activity_code, status, session_date), (status, created_at)
- Consider daily rollups if volume grows

Outbox & replay

- On each ledger write, append outbox record; worker delivers to analytics/cache; idempotent keys ensure safe replay

Observability & SLOs

- Log fields: user_id, activity_code, external_event_id, delta_points, badge_codes[]
- SLO: 99.9% Kajabi tags → ledger within 60s; alert on `queued_unmatched` > N for >15m

OpenAPI & errors

- Error envelope: { type, code, message, details[] }
- Examples for caps/duplicate/unmatched included in errors doc

Backfills

- Dry‑run diff → sample verification → supervised apply; tag with backfill_id in meta
