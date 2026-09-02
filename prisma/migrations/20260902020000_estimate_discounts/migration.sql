-- Per-line discount (% or ₹) and estimate-wide global discount (% or ₹).
ALTER TABLE "EstimateItem" ADD COLUMN "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "EstimateItem" ADD COLUMN "discountIsPercent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Estimate" ADD COLUMN "globalDiscountValue" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Estimate" ADD COLUMN "globalDiscountIsPercent" BOOLEAN NOT NULL DEFAULT true;
