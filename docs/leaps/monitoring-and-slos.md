# Monitoring & SLOs

Dashboards

- Kajabi events by status; processing latency
- Ledger writes by activity
- Badge grants by code
- Cap rejections by type
- Stats freshness vs last compute time

Metrics

- leaps_kajabi_events_total{status}
- leaps_webhook_latency_seconds_bucket
- leaps_ledger_writes_total{activity}
- leaps_badge_grants_total{code}
- leaps_cap_rejections_total{type}
- leaps_stats_compute_age_seconds

Alerts

- queued_unmatched > 50 for > 15m
- webhook p99 latency > 60s for 10m
- duplicate external_event_id violations > 0

