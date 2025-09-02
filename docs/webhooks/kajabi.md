# Kajabi Webhook Spec (Draft)

Endpoint
- `POST /api/webhooks/kajabi`

Event Handling
- Accepts JSON payload with user email and course/tag identifiers.
- Store full payload in `kajabi_events` table with received_at timestamp.
- Attempt to match user by email; if matched, create Learn ledger entry (20 pts) unless already awarded.
- Mark event processed and link to user id; otherwise remain unprocessed for admin reconciliation.

Idempotency
- Use event id (if present) as `external_event_id` in `points_ledger` to prevent duplicates.

Security
- Shared secret in header; HMAC signature verification (TBD).

