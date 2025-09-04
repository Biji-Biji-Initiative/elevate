-- Add submission_attachments table to match updated Prisma schema

CREATE TABLE "submission_attachments" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_attachments_pkey" PRIMARY KEY ("id")
);

-- Create unique index for submission_id + path combination
CREATE UNIQUE INDEX "submission_attachments_submission_id_path_key" ON "submission_attachments"("submission_id", "path");

-- Create index for submission_id lookups
CREATE INDEX "submission_attachments_submission_id_idx" ON "submission_attachments"("submission_id");

-- Add foreign key constraint
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;