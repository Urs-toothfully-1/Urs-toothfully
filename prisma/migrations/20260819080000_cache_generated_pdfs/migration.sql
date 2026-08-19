-- Cache rendered PDFs so the same document is not re-rendered on every request.
-- Both columns are nullable: existing rows simply have no cached copy yet.
ALTER TABLE "GeneratedDocument" ADD COLUMN "content" BYTEA;
ALTER TABLE "GeneratedDocument" ADD COLUMN "sourceHash" VARCHAR(64);

-- Serving a cached copy looks up by (type, source) and checks freshness.
CREATE INDEX "GeneratedDocument_documentType_generatedAt_idx"
  ON "GeneratedDocument"("documentType", "generatedAt");
