-- Add user_type enum and column to users table
CREATE TYPE "UserType" AS ENUM ('EDUCATOR', 'STUDENT');
ALTER TABLE "users" ADD COLUMN "user_type" "UserType" NOT NULL DEFAULT 'EDUCATOR';
