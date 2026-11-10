-- Per-user access restrictions (null = full access for the role)
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;
