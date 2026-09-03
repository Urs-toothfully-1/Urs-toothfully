-- Referral reward credit consumed by an estimate (shown as its own line).
ALTER TABLE "Estimate" ADD COLUMN "referralCreditApplied" DECIMAL(10,2) NOT NULL DEFAULT 0;
