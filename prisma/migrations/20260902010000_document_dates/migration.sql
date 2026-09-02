-- Doctor-settable date shown on the estimate & prescription (nullable → falls back to createdAt).
ALTER TABLE "Estimate" ADD COLUMN "documentDate" DATE;
ALTER TABLE "PrescriptionRecord" ADD COLUMN "documentDate" DATE;
