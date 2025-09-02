# Roles & Permissions (Draft)

- Participant
  - Create submissions; view own submissions; set visibility; view own points/badges.
- Reviewer
  - All participant permissions; view pending queue; approve/reject; add review notes.
- Admin
  - All reviewer permissions; manage roles; exports; refresh leaderboards; view audit logs.
- Superadmin (optional)
  - Elevated admin for emergency and program-wide settings.

Implementation
- Clerk publicMetadata contains role; backend checks via `requireRole()` helper.
- All admin actions produce AuditLog entries.

