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
    "attachments" JSONB NOT NULL,
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