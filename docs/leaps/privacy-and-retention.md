# Privacy & Retention (DPIA‑lite)

Data inventory

- Users: name, email, user_type, cohort
- Submissions: evidence metadata and storage keys (no public PII)
- Ledger: points, provenance
- Kajabi events: event ids, tag names, contactId/email

Retention

- Evidence: 24 months
- Kajabi raw: 12 months → anonymize contact email, keep contactId
- Logs: 90 days hot, 12 months cold with PII scrubbed

DSR

- Delete user: remove personal data; retain aggregated counters and anonymized metrics

Public pages

- Only aggregates; no PII rendering; signed URLs only for reviewers

Security controls

- CSP (reviewer UI): `default-src 'none'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'`
- Rate limits: `/api/kajabi/webhook` 60 rpm (burst 120) per IP + HMAC key
- Upload size limits: max 10MB per file; respond `413` with standard envelope
- Evidence hashing: SHA‑256 per file to dedupe and reduce storage
- Reviewer redaction: if CSV contains incidental PII, redact before re-upload or store redacted variant
