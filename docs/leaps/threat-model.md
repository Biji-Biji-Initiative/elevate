# Threat Model — Key Vectors and Mitigations

Vectors

- Webhook replay/spoof: HMAC/secret, timestamp window, idempotent keys
- Duplicate course credits: tag-per-user uniqueness
- AMPLIFY gaming: caps, duplicate flag, reviewer rubric
- Multi-accounting/email change: contactId binding and admin reconciliation
- Evidence malware/PII: AV scan, private bucket, safe serving, retention limits

Mitigations mapping

- Kajabi: `kajabi-learn.md` (HMAC, composite uniq, binding, replay window)
- AMPLIFY: `amplify.md` (caps, lock, duplicate detection)
- Ops: `ops-and-reliability.md` (storage, logs, SLOs)
- Errors: `errors-and-openapi.md` (structured errors)

Tests

- See `tests.md` for race/replay/caps/duplicate/PII flows

