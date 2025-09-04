-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARTICIPANT', 'REVIEWER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('MANUAL', 'WEBHOOK', 'FORM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARTICIPANT',
    "school" TEXT,
    "cohort" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kajabi_contact_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_points" INTEGER NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_code" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "payload" JSONB NOT NULL,
    "reviewer_id" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_code" TEXT NOT NULL,
    "source" "LedgerSource" NOT NULL,
    "delta_points" INTEGER NOT NULL,
    "external_source" TEXT,
    "external_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "earned_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_code" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earned_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kajabi_events" (
    "id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "user_match" TEXT,

    CONSTRAINT "kajabi_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_attachments" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_kajabi_contact_id_key" ON "users"("kajabi_contact_id");

-- CreateIndex
CREATE INDEX "submissions_user_id_activity_code_idx" ON "submissions"("user_id", "activity_code");

-- CreateIndex
CREATE INDEX "points_ledger_user_id_activity_code_idx" ON "points_ledger"("user_id", "activity_code");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_external_event_id_key" ON "points_ledger"("external_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "earned_badges_user_id_badge_code_key" ON "earned_badges"("user_id", "badge_code");

-- CreateIndex
CREATE INDEX "earned_badges_badge_code_idx" ON "earned_badges"("badge_code");

-- CreateIndex
CREATE UNIQUE INDEX "submission_attachments_submission_id_path_key" ON "submission_attachments"("submission_id", "path");

-- CreateIndex
CREATE INDEX "submission_attachments_submission_id_idx" ON "submission_attachments"("submission_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_activity_code_fkey" FOREIGN KEY ("activity_code") REFERENCES "activities"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_activity_code_fkey" FOREIGN KEY ("activity_code") REFERENCES "activities"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_badges" ADD CONSTRAINT "earned_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_badges" ADD CONSTRAINT "earned_badges_badge_code_fkey" FOREIGN KEY ("badge_code") REFERENCES "badges"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business Logic Constraints (from 003_constraints.sql)
-- Enforce one active LEARN submission (PENDING or APPROVED) per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_learn_active_submission
ON submissions (user_id)
WHERE activity_code = 'LEARN' AND status IN ('PENDING', 'APPROVED');

-- Ensure external_event_id remains unique (explicit constraint for business logic)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_external_event
ON points_ledger ((COALESCE(external_event_id, '')))
WHERE external_event_id IS NOT NULL;

-- Anti-Gaming Trigger for AMPLIFY quota (from 004_amplify_quota.sql)
-- Enforce 7-day rolling limits for AMPLIFY submissions
-- peersTrained <= 50 and studentsTrained <= 200 including the new row
CREATE OR REPLACE FUNCTION check_amplify_quota() RETURNS trigger AS $$
DECLARE
  total_peers INTEGER;
  total_students INTEGER;
  new_peers INTEGER;
  new_students INTEGER;
BEGIN
  IF NEW.activity_code <> 'AMPLIFY' THEN
    RETURN NEW;
  END IF;

  -- Extract new values from JSON payload
  new_peers := COALESCE( (NEW.payload->>'peersTrained')::int, 0 );
  new_students := COALESCE( (NEW.payload->>'studentsTrained')::int, 0 );

  -- Sum existing values in last 7 days
  SELECT
    COALESCE(SUM( (s.payload->>'peersTrained')::int ), 0),
    COALESCE(SUM( (s.payload->>'studentsTrained')::int ), 0)
  INTO total_peers, total_students
  FROM submissions s
  WHERE s.user_id = NEW.user_id
    AND s.activity_code = 'AMPLIFY'
    AND s.created_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days');

  IF (total_peers + new_peers) > 50 THEN
    RAISE EXCEPTION 'Peer training limit exceeded (7-day total % + new % > 50)', total_peers, new_peers
      USING ERRCODE = '23514';
  END IF;

  IF (total_students + new_students) > 200 THEN
    RAISE EXCEPTION 'Student training limit exceeded (7-day total % + new % > 200)', total_students, new_students
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_amplify_quota ON submissions;
CREATE TRIGGER trg_check_amplify_quota
BEFORE INSERT ON submissions
FOR EACH ROW
EXECUTE PROCEDURE check_amplify_quota();

-- Materialized Views for Performance (from 002_views.sql)
-- Create materialized view for all-time leaderboard totals
CREATE MATERIALIZED VIEW leaderboard_totals AS
SELECT 
    u.id as user_id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    u.cohort,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED' AND s.visibility = 'PUBLIC') as public_submissions,
    MAX(pl.created_at) as last_activity_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id
LEFT JOIN submissions s ON u.id = s.user_id
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
HAVING COALESCE(SUM(pl.delta_points), 0) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create index on the materialized view for faster queries
CREATE INDEX idx_leaderboard_totals_points ON leaderboard_totals(total_points DESC);
CREATE INDEX idx_leaderboard_totals_handle ON leaderboard_totals(handle);

-- Create materialized view for 30-day rolling leaderboard
CREATE MATERIALIZED VIEW leaderboard_30d AS
SELECT 
    u.id as user_id,
    u.handle,
    u.name,
    u.avatar_url,
    u.school,
    u.cohort,
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'APPROVED' AND s.visibility = 'PUBLIC') as public_submissions,
    MAX(pl.created_at) as last_activity_at
FROM users u
LEFT JOIN points_ledger pl ON u.id = pl.user_id 
    AND pl.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN submissions s ON u.id = s.user_id 
    AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND s.status = 'APPROVED' 
    AND s.visibility = 'PUBLIC'
WHERE u.role = 'PARTICIPANT'
GROUP BY u.id, u.handle, u.name, u.avatar_url, u.school, u.cohort
HAVING COALESCE(SUM(pl.delta_points), 0) > 0
ORDER BY total_points DESC, last_activity_at DESC;

-- Create index on the 30-day materialized view
CREATE INDEX idx_leaderboard_30d_points ON leaderboard_30d(total_points DESC);
CREATE INDEX idx_leaderboard_30d_handle ON leaderboard_30d(handle);

-- Create materialized view for activity metrics
CREATE MATERIALIZED VIEW activity_metrics AS
SELECT 
    a.code,
    a.name,
    COUNT(s.id) as total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'PENDING') as pending_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'REJECTED') as rejected_submissions,
    COUNT(s.id) FILTER (WHERE s.visibility = 'PUBLIC' AND s.status = 'APPROVED') as public_submissions,
    COALESCE(SUM(pl.delta_points), 0) as total_points_awarded,
    COALESCE(AVG(pl.delta_points), 0) as avg_points_per_submission
FROM activities a
LEFT JOIN submissions s ON a.code = s.activity_code
LEFT JOIN points_ledger pl ON a.code = pl.activity_code AND s.user_id = pl.user_id
GROUP BY a.code, a.name
ORDER BY a.code;

-- Create index on activity metrics
CREATE INDEX idx_activity_metrics_code ON activity_metrics(code);

-- Create function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_totals;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_30d;
    REFRESH MATERIALIZED VIEW CONCURRENTLY activity_metrics;
END;
$$ LANGUAGE plpgsql;