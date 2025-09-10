# Pull Request

## Summary
- What changed and why?
- Related issues/links:

## LEAPS Conformance
- [ ] Verified against `docs/leaps/agent-tracker.md` (Activity Canon, points, badges, approvals, stats)
- [ ] Dashboard points derive from ledger (Option B)
- [ ] LEARN points only via Kajabi tags (no admin approval points)

## Admin & Ops
- [ ] Admin pages localized (where applicable)
- [ ] SLO instrumentation present on new/critical endpoints
- [ ] Retention cron unaffected by changes

## Staging Validation
- [ ] Completed `docs/qa/STAGING_VALIDATION.md`
- [ ] Attached a validation report (`docs/qa/VALIDATION_REPORT_TEMPLATE.md`) with screenshots
- [ ] (Optional) Ran script: `pnpm -C elevate qa:validate:staging`

## Backwards Compatibility & Security
- [ ] APIs maintain envelopes and typed schemas
- [ ] No secrets committed; env changes documented
- [ ] Storage access remains server-only; signed URLs protected

## Screenshots / Evidence
- [ ] Admin Kajabi (health/invite)
- [ ] Admin Storage (retention)
- [ ] Admin Ops (SLOs)
- [ ] Web Dashboard / Leaderboard

## Notes
- Anything else reviewers should know.
