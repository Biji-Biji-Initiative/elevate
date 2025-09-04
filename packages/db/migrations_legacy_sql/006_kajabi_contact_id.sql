-- Add kajabi_contact_id field to users table

ALTER TABLE "users" ADD COLUMN "kajabi_contact_id" TEXT;

-- Create unique index for kajabi_contact_id
CREATE UNIQUE INDEX "users_kajabi_contact_id_key" ON "users"("kajabi_contact_id");