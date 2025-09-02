-- Initial schema for MS Elevate LEAPS Tracker
-- Based on Prisma schema with additional Supabase-specific configurations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
CREATE TYPE "Role" AS ENUM (
  'PARTICIPANT',
  'REVIEWER',
  'ADMIN',
  'SUPERADMIN'
);

CREATE TYPE "SubmissionStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "Visibility" AS ENUM (
  'PUBLIC',
  'PRIVATE'
);

CREATE TYPE "LedgerSource" AS ENUM (
  'MANUAL',
  'WEBHOOK',
  'FORM'
);

-- Create tables
CREATE TABLE "users" (
    "id" TEXT PRIMARY KEY,
    "handle" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARTICIPANT',
    "school" TEXT,
    "cohort" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "activities" (
    "code" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "default_points" INTEGER NOT NULL
);

CREATE TABLE "submissions" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "activity_code" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "payload" JSONB NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "reviewer_id" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "points_ledger" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "activity_code" TEXT NOT NULL,
    "source" "LedgerSource" NOT NULL,
    "delta_points" INTEGER NOT NULL,
    "external_source" TEXT,
    "external_event_id" TEXT UNIQUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "badges" (
    "code" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "icon_url" TEXT
);

CREATE TABLE "earned_badges" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "badge_code" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("user_id", "badge_code")
);

CREATE TABLE "kajabi_events" (
    "id" TEXT PRIMARY KEY,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "user_match" TEXT
);

CREATE TABLE "audit_log" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_activity_code_fkey" 
    FOREIGN KEY ("activity_code") REFERENCES "activities"("code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_activity_code_fkey" 
    FOREIGN KEY ("activity_code") REFERENCES "activities"("code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "earned_badges" ADD CONSTRAINT "earned_badges_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "earned_badges" ADD CONSTRAINT "earned_badges_badge_code_fkey" 
    FOREIGN KEY ("badge_code") REFERENCES "badges"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX "submissions_user_id_activity_code_idx" ON "submissions"("user_id", "activity_code");
CREATE INDEX "points_ledger_user_id_activity_code_idx" ON "points_ledger"("user_id", "activity_code");
CREATE INDEX "earned_badges_badge_code_idx" ON "earned_badges"("badge_code");
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON "submissions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();