# Admin Review Flows

Queue
- List PENDING submissions; filter by stage; search by user/email.
- Open detail to preview payload and attachments.

Approve
- On approval, create ledger entry with default points (Learn 20, Explore 50, Present 20; Amplify calculated) and mark submission APPROVED.
- Call `refresh_leaderboards()`.
- Log action in AuditLog.

Reject
- Mark REJECTED with review note; no points awarded.
- Log action.

Kajabi reconciliation
- Show unmatched Kajabi events; search users by email; assign to user; add Learn ledger entry.

Exports
- CSV: submissions (filters), leaderboard snapshot (all-time/30d).

