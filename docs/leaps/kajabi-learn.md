# Kajabi → LEARN (10+10) — Webhook Spec

Objective: Award +10 for each course completion tag, capped at 20 total per user; grant Starter badge only when both tags exist. No submissions required for counters (Option B).

Tags

- elevate-ai-1-completed → +10
- elevate-ai-2-completed → +10

Webhook contract (recommended JSON)

```json
{
  "event_id": "abc123",
  "created_at": "2025-01-02T03:04:05Z",
  "contact": { "id": "k_987", "email": "user@example.com" },
  "tag": { "id": "t_1", "name": "elevate-ai-1-completed" }
}
```

Security

- Require `X-Webhook-Secret` or HMAC signature.
- Reject if clock skew > 5 minutes unless explicitly replayed by admin.
- Rate limit and dedupe using `external_event_id`.

Audit and matching

- Persist `kajabi_events` with UNIQUE (eventId, tagName); store contactId, email, createdAtUtc, raw.
- Bind `contactId → userId` after first match; prefer contactId over email for future events.

Idempotency and tag-per-user guard

- Ledger `external_event_id = kajabi:<event_id>|tag:<tag_name>`.
- Additionally, enforce one grant per tag per user via either:
  - a `learn_tag_grants` table UNIQUE(user_id, tag_name), or
  - unique derived constraint on ledger meta (distinct (user_id, meta.tag_name)).

Award algorithm (transaction)

1. If no user, keep event `queued_unmatched` and return 202.
2. Insert tag-per-user grant (or check unique); if duplicate, return 200 with `duplicate: true`.
3. Insert ledger +10 with `eventTime=created_at`, meta.tag_name, ignore on duplicate.
4. Grant badges idempotently (Starter only when both tags present).
5. Mark event `processed`.

Counters (Option B)

- educators_learning: distinct users with any Learn tag grant (exclude STUDENT).
- micro_credentials: COUNT(\*) from tag-per-user grants (max 2 per user).

Reconciliation UI (admin)

- List `kajabi_events` with `status='queued_unmatched'`; attach to user and replay safely.
