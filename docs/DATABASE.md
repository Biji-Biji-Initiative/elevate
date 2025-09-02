# Database Schema Documentation

> Generated on 2025-09-02T13:52:38.043Z
> Source: `packages/db/schema.prisma`

## Overview

This document describes the database schema for the MS Elevate LEAPS Tracker application. The schema is defined using Prisma ORM and serves as the single source of truth for database structure.

## Configuration

### Datasource
- **Provider**: "postgresql"
- **URL**: Environment variable `DATABASE_URL`

### Generator
- **Provider**: "prisma-client-js"

## Enums

### Role

| Value | Description |
|-------|-------------|
| `PARTICIPANT` | Default role for educators |
| `REVIEWER` | Can review and approve submissions |
| `ADMIN` | Full administrative access |
| `SUPERADMIN` | System-level administrative access |

### SubmissionStatus

| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting review |
| `APPROVED` | Accepted and points awarded |
| `REJECTED` | Rejected with review notes |

### Visibility

| Value | Description |
|-------|-------------|
| `PUBLIC` | Visible on public profiles and leaderboard |
| `PRIVATE` | Only visible to user and reviewers |

### LedgerSource

| Value | Description |
|-------|-------------|
| `MANUAL` | Manually adjusted by admin |
| `WEBHOOK` | Automatic via Kajabi webhook |
| `FORM` | Through submission approval process |

## Models

### User

Represents application users synced from Clerk authentication service.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | `String` | 🔑 Primary Key | Unique identifier, mirrors Clerk user ID |
| `handle` | `String` | 🔐 Unique | Unique username/handle for public profile URLs |
| `name` | `String` |  |  |
| `email` | `String` | 🔐 Unique |  |
| `avatar_url` | `String??` |  |  |
| `role` | `Role` | ⚙️ Default |  |
| `school` | `String??` |  |  |
| `cohort` | `String??` |  |  |
| `kajabi_contact_id` | `String??` | 🔐 Unique | Kajabi contact ID for webhook matching |
| `created_at` | `DateTime` | ⚙️ Default |  |
| `submissions` | `Submission[][]` |  |  |
| `ledger` | `PointsLedger[][]` |  |  |
| `earned_badges` | `EarnedBadge[][]` |  |  |

#### Indexes

- `@@map("users")`

### Activity

Defines the 5 LEAPS framework activities (Learn, Explore, Amplify, Present, Shine).

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `code` | `String` | 🔑 Primary Key |  |
| `name` | `String` |  |  |
| `default_points` | `Int` |  | Standard points awarded for this activity |
| `submissions` | `Submission[][]` |  |  |
| `ledger` | `PointsLedger[][]` |  |  |

#### Indexes

- `@@map("activities")`

### Submission

Evidence submissions for LEAPS activities with review workflow.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | `String` | 🔑 Primary Key, ⚙️ Default |  |
| `user_id` | `String` |  |  |
| `user` | `User` | 🔗 Relation |  |
| `activity_code` | `String` |  |  |
| `activity` | `Activity` | 🔗 Relation |  |
| `status` | `SubmissionStatus` | ⚙️ Default |  |
| `visibility` | `Visibility` | ⚙️ Default | Controls public/private visibility on profiles |
| `payload` | `Json` |  | Activity-specific submission data (JSON) |
| `attachments` | `Json` |  | Array of file storage paths |
| `reviewer_id` | `String??` |  |  |
| `review_note` | `String??` |  |  |
| `created_at` | `DateTime` | ⚙️ Default |  |
| `updated_at` | `DateTime` |  |  |

#### Indexes

- `@@index([user_id, activity_code])`
- `@@map("submissions")`

#### Relations

- **user**: User who created this submission
- **activity**: LEAPS activity this submission is for

### PointsLedger

Append-only ledger tracking all point changes for audit trail.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | `String` | 🔑 Primary Key, ⚙️ Default |  |
| `user_id` | `String` |  |  |
| `user` | `User` | 🔗 Relation |  |
| `activity_code` | `String` |  |  |
| `activity` | `Activity` | 🔗 Relation |  |
| `source` | `LedgerSource` |  |  |
| `delta_points` | `Int` |  | Point change (positive or negative) |
| `external_source` | `String??` |  |  |
| `external_event_id` | `String??` | 🔐 Unique | Unique ID for idempotent webhook processing |
| `created_at` | `DateTime` | ⚙️ Default |  |

#### Indexes

- `@@index([user_id, activity_code])`
- `@@map("points_ledger")`

#### Relations

- **user**: User these points belong to
- **activity**: Activity these points were earned for

### Badge

Achievement badges that users can earn based on criteria.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `code` | `String` | 🔑 Primary Key |  |
| `name` | `String` |  |  |
| `description` | `String` |  |  |
| `criteria` | `Json` |  |  |
| `icon_url` | `String??` |  |  |
| `earned_badges` | `EarnedBadge[][]` |  |  |

#### Indexes

- `@@map("badges")`

### EarnedBadge

Junction table tracking which badges users have earned.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | `String` | 🔑 Primary Key, ⚙️ Default |  |
| `user_id` | `String` |  |  |
| `user` | `User` | 🔗 Relation |  |
| `badge_code` | `String` |  |  |
| `badge` | `Badge` | 🔗 Relation |  |
| `earned_at` | `DateTime` | ⚙️ Default |  |

#### Indexes

- `@@unique([user_id, badge_code])`
- `@@index([badge_code])`
- `@@map("earned_badges")`

#### Relations

- **user**: Related user
- **badge**: Related badge

### KajabiEvent

Webhook events from Kajabi for automatic Learn activity credit.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | `String` | 🔑 Primary Key |  |
| `received_at` | `DateTime` | ⚙️ Default |  |
| `payload` | `Json` |  |  |
| `processed_at` | `DateTime??` |  |  |
| `user_match` | `String??` |  |  |

#### Indexes

- `@@map("kajabi_events")`

### AuditLog

System audit trail for administrative actions and changes.

#### Fields

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | `String` | 🔑 Primary Key, ⚙️ Default |  |
| `actor_id` | `String` |  |  |
| `action` | `String` |  |  |
| `target_id` | `String??` |  |  |
| `meta` | `Json??` |  |  |
| `created_at` | `DateTime` | ⚙️ Default |  |

#### Indexes

- `@@index([actor_id, created_at])`
- `@@map("audit_log")`

## Security & Access Control

### Row Level Security (RLS)

All tables have Row Level Security enabled with the following policies:

#### Users Table
- Users can view and update their own profile
- Public profiles are viewable by all authenticated users
- Only admins can create/delete users

#### Submissions Table
- Users can create and view their own submissions
- Users can update their own pending submissions
- Reviewers can view all submissions for review
- Public submissions are viewable by all users

#### Points Ledger
- Users can view their own points history
- Reviewers can view all points for audit purposes
- Points entries are append-only (immutable)

#### Audit Log
- Only admins can view audit logs
- All users can create audit entries for their actions
- Audit logs are append-only for integrity

### Authentication Functions

- `auth.get_user_role()`: Extract user role from JWT token
- `auth.is_admin()`: Check admin privileges
- `auth.is_reviewer()`: Check reviewer privileges
- `auth.get_user_id()`: Get current user ID from JWT

## Views & Materialized Views

### Leaderboard Views

#### `leaderboard_totals`
All-time leaderboard with public submissions only.

#### `leaderboard_30d`  
30-day rolling leaderboard for recent activity.

#### `user_points_summary`
Points breakdown per user by activity type.

### Metrics Views

#### `public_submission_metrics`
Aggregated submission statistics without personal data.

All views respect RLS policies and only show appropriate data based on user permissions.

## Functions

### `get_user_total_points(target_user_id TEXT)`
Returns total points for a user with permission checking.
- Users can get their own points
- Admins can get any user's points
- Returns NULL for unauthorized access

### `refresh_leaderboards()`
Refreshes materialized views for leaderboard data.
- Run after bulk point changes
- Typically called post-deployment

## Migration Management

### Schema Source of Truth

Prisma schema (`packages/db/schema.prisma`) serves as the canonical definition. All database changes should:

1. Start with Prisma schema updates
2. Generate migrations using provided scripts
3. Apply and test migrations
4. Update documentation

### Migration Scripts

- `scripts/db/generate-migrations.sh`: Create SQL migrations from Prisma
- `scripts/db/check-drift.sh`: Detect schema drift
- `scripts/db/sync-supabase.sh`: Sync Supabase migrations

### Best Practices

1. Always update Prisma schema first
2. Test migrations locally before deploying
3. Create backups before major schema changes
4. Use append-only patterns for audit data
5. Maintain referential integrity with foreign keys

---

*This documentation is auto-generated from the Prisma schema. Last updated: 2025-09-02T13:52:38.044Z*
