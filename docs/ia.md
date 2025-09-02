# Information Architecture

- Public
  - `/` Home: hero, LEAPS tiles, impact counters, targets, leaderboard preview, partners, footer.
  - `/leaderboard`: Top-20; toggle all-time/30d.
  - `/metrics/[stage]`: Aggregate counters per stage (no PII).
  - `/u/[handle]`: Public profile; approved + public submissions only.
- Participant (auth)
  - `/dashboard`: Points, badges, submission history; links to stage forms.
  - `/dashboard/{learn|explore|amplify|present|shine}`: Stage forms.
- Admin (auth, reviewer/admin)
  - `/admin`: Overview.
  - `/admin/queue`: Pending submissions.
  - `/admin/review/[id]`: Review detail.
  - `/admin/users`: Users/roles.
  - `/admin/exports`: CSVs.
  - `/admin/kajabi`: Reconciliation.

