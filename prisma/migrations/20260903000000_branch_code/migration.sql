-- Short public branch code (1, 2, 3…) for the /review URL instead of the UUID.
ALTER TABLE "Branch" ADD COLUMN "code" VARCHAR(20);
UPDATE "Branch" SET "code" = sub.rn::text
  FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn FROM "Branch") sub
  WHERE "Branch".id = sub.id;
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");
