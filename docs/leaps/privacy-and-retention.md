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

