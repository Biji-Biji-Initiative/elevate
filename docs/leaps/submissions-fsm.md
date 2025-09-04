# Submissions FSM, Ledger Invariants, and RBAC

FSM (per submission)

- States: DRAFT → SUBMITTED → {APPROVED | REJECTED}; APPROVED → REVOKED (admin only)
- Transitions:
  - create DRAFT (participant)
  - submit → SUBMITTED (participant)
  - approve → APPROVED (reviewer/admin)
  - reject → REJECTED (reviewer/admin)
  - revoke → REVOKED (admin)

RBAC

- participant: create, edit DRAFT, submit; view own submissions
- reviewer: view SUBMITTED; approve/reject within cohort; cannot revoke
- admin: all actions; can revoke and apply corrections

Ledger invariants

- No overwrites; compensating rows for corrections.
- External event ids (deterministic):
  - approval: `submission:<id>:approved:v1`
  - revocation: `submission:<id>:revoked:v1`
  - correction: `submission:<id>:corrected:<ts>`
- AMPLIFY approval uses a per‑user advisory transaction lock; recheck caps under lock before writing ledger.

Badges

- After any ledger write, run `grantBadgesForUser(userId)`.
- Sticky: Starter, In‑Class Innovator, Community Voice, Shine Nominee.

Audit

- Log all transitions with actor_id, from→to, target_id, meta (reason).

Time windows

- Caps computed by sessionDate in org TZ; backfills >30 days require admin override.
