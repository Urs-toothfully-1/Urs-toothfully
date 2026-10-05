-- Treatment invoices, estimate price ranges, payment options, referral reward types,
-- and a referral code for every patient.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReferralRewardType" ADD VALUE 'FREE_CHECKUP';
ALTER TYPE "ReferralRewardType" ADD VALUE 'FREE_TREATMENT';

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "invoiceBilling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoicedTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalMax" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "EstimateItem" ADD COLUMN     "unitRateMax" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PaymentAgreement" ADD COLUMN     "options" JSONB;

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "redeemedInvoiceId" TEXT,
ADD COLUMN     "redeemedNote" VARCHAR(300);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" VARCHAR(20) NOT NULL,
    "estimateId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "visitId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountIsPercent" BOOLEAN NOT NULL DEFAULT false,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" VARCHAR(500),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "estimateItemId" TEXT,
    "treatmentName" VARCHAR(200) NOT NULL,
    "toothNumber" VARCHAR(120),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitRate" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_patientId_invoiceDate_idx" ON "Invoice"("patientId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_estimateId_idx" ON "Invoice"("estimateId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every patient gets a referral code (6 chars, no look-alikes 0/O/1/I/L),
-- matching lib/referral-code.ts. Retries on the rare collision.
DO $$
DECLARE
  r RECORD;
  c TEXT;
  alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  FOR r IN SELECT id FROM "Patient" WHERE "referralCode" IS NULL LOOP
    LOOP
      c := '';
      FOR i IN 1..6 LOOP
        c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Patient" WHERE "referralCode" = c);
    END LOOP;
    UPDATE "Patient" SET "referralCode" = c WHERE id = r.id;
  END LOOP;
END $$;
