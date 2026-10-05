-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('DISCOUNT_FLAT', 'DISCOUNT_PERCENT', 'FREE_CHECKUP', 'FREE_TREATMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'NOT_INTERESTED');

-- AlterTable
ALTER TABLE "AppointmentRequest" ADD COLUMN     "referralCode" VARCHAR(12);

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "refereeRedemptionId" TEXT,
ADD COLUMN     "referrerRedemptionId" TEXT;

-- CreateTable
CREATE TABLE "RewardCampaign" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "tagline" VARCHAR(200),
    "referrerOffer" VARCHAR(300) NOT NULL,
    "refereeOffer" VARCHAR(300) NOT NULL,
    "referrerKind" "RewardKind" NOT NULL DEFAULT 'OTHER',
    "referrerValue" DECIMAL(10,2),
    "refereeKind" "RewardKind" NOT NULL DEFAULT 'OTHER',
    "refereeValue" DECIMAL(10,2),
    "terms" VARCHAR(1000),
    "startsAt" DATE NOT NULL,
    "endsAt" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'teal',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralRedemption" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "campaignId" TEXT,
    "points" INTEGER NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "value" DECIMAL(10,2),
    "description" VARCHAR(300) NOT NULL,
    "note" VARCHAR(300),
    "usedAt" TIMESTAMP(3),
    "usedNote" VARCHAR(300),
    "invoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotentialClient" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(150),
    "area" VARCHAR(150),
    "source" VARCHAR(100),
    "notes" VARCHAR(500),
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "lastMessagedAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PotentialClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RewardCampaign_isActive_startsAt_idx" ON "RewardCampaign"("isActive", "startsAt");

-- CreateIndex
CREATE INDEX "ReferralRedemption_patientId_createdAt_idx" ON "ReferralRedemption"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralRedemption_campaignId_idx" ON "ReferralRedemption"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "PotentialClient_mobile_key" ON "PotentialClient"("mobile");

-- CreateIndex
CREATE INDEX "PotentialClient_status_createdAt_idx" ON "PotentialClient"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerRedemptionId_fkey" FOREIGN KEY ("referrerRedemptionId") REFERENCES "ReferralRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeRedemptionId_fkey" FOREIGN KEY ("refereeRedemptionId") REFERENCES "ReferralRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCampaign" ADD CONSTRAINT "RewardCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "RewardCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotentialClient" ADD CONSTRAINT "PotentialClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

