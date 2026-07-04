-- CreateEnum
CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RETRY', 'CANCELLED');

-- CreateTable
CREATE TABLE "WhatsAppSettings" (
    "id" TEXT NOT NULL,
    "businessAccountId" VARCHAR(50),
    "phoneNumberId" VARCHAR(50),
    "accessTokenEnc" TEXT,
    "webhookVerifyToken" VARCHAR(120),
    "webhookSecretEnc" TEXT,
    "graphApiVersion" VARCHAR(10) NOT NULL DEFAULT 'v21.0',
    "businessDisplayName" VARCHAR(120),
    "defaultCountryCode" VARCHAR(5) NOT NULL DEFAULT '91',
    "apiStatus" VARCHAR(30),
    "phoneNumberStatus" VARCHAR(50),
    "businessVerificationStatus" VARCHAR(50),
    "lastSyncAt" TIMESTAMP(3),
    "sendingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "queuePaused" BOOLEAN NOT NULL DEFAULT false,
    "messageRateLimit" INTEGER NOT NULL DEFAULT 20,
    "dailySendingLimit" INTEGER NOT NULL DEFAULT 1000,
    "maxRetryCount" INTEGER NOT NULL DEFAULT 3,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "displayName" VARCHAR(150) NOT NULL,
    "category" "WhatsAppTemplateCategory" NOT NULL DEFAULT 'UTILITY',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "headerType" VARCHAR(20),
    "headerText" VARCHAR(200),
    "body" TEXT NOT NULL,
    "footerText" VARCHAR(200),
    "buttons" JSONB,
    "variables" JSONB,
    "metaTemplateId" VARCHAR(60),
    "triggerKey" VARCHAR(60),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "branchId" TEXT,
    "templateId" TEXT,
    "templateName" VARCHAR(120) NOT NULL,
    "toPhone" VARCHAR(20) NOT NULL,
    "variables" JSONB,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'PENDING',
    "triggerKey" VARCHAR(60),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metaMessageId" VARCHAR(120),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookLog" (
    "id" TEXT NOT NULL,
    "eventType" VARCHAR(50),
    "metaMessageId" VARCHAR(120),
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConsent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consented" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "consentIp" VARCHAR(45),
    "consentVersion" VARCHAR(10) NOT NULL DEFAULT '1.0',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeAttempt" (
    "id" TEXT NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_name_key" ON "WhatsAppTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_triggerKey_key" ON "WhatsAppTemplate"("triggerKey");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_category_status_idx" ON "WhatsAppTemplate"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_metaMessageId_key" ON "WhatsAppMessage"("metaMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_scheduledFor_idx" ON "WhatsAppMessage"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_patientId_createdAt_idx" ON "WhatsAppMessage"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_branchId_createdAt_idx" ON "WhatsAppMessage"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_toPhone_idx" ON "WhatsAppMessage"("toPhone");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookLog_metaMessageId_idx" ON "WhatsAppWebhookLog"("metaMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookLog_receivedAt_idx" ON "WhatsAppWebhookLog"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConsent_patientId_key" ON "WhatsAppConsent"("patientId");

-- CreateIndex
CREATE INDEX "IntakeAttempt_ipAddress_createdAt_idx" ON "IntakeAttempt"("ipAddress", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppSettings" ADD CONSTRAINT "WhatsAppSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

