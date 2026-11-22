-- Rewards catalogue + 500-point referrals.
CREATE TABLE "RewardItem" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "points" INTEGER NOT NULL,
    "kind" "RewardKind" NOT NULL DEFAULT 'OTHER',
    "value" DECIMAL(10,2),
    "description" VARCHAR(300),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RewardItem_isActive_points_idx" ON "RewardItem"("isActive", "points");
ALTER TABLE "RewardItem" ADD CONSTRAINT "RewardItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralRedemption" ADD COLUMN "rewardItemId" TEXT;
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_rewardItemId_fkey" FOREIGN KEY ("rewardItemId") REFERENCES "RewardItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Old redemptions counted 1 point per referral side; a side is now worth 500.
UPDATE "ReferralRedemption" SET "points" = "points" * 500;
