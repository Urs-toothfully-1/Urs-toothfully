-- WhatsApp conversation log: inbound patient messages + outbound free-form replies.
CREATE TABLE "WhatsAppInbound" (
    "id" TEXT NOT NULL,
    "direction" VARCHAR(4) NOT NULL DEFAULT 'IN',
    "fromPhone" VARCHAR(20) NOT NULL,
    "patientId" TEXT,
    "wamid" VARCHAR(128),
    "text" TEXT,
    "botAction" VARCHAR(40),
    "sentById" TEXT,
    "needsStaff" BOOLEAN NOT NULL DEFAULT false,
    "handledByStaff" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppInbound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppInbound_wamid_key" ON "WhatsAppInbound"("wamid");
CREATE INDEX "WhatsAppInbound_fromPhone_receivedAt_idx" ON "WhatsAppInbound"("fromPhone", "receivedAt");
CREATE INDEX "WhatsAppInbound_needsStaff_handledByStaff_idx" ON "WhatsAppInbound"("needsStaff", "handledByStaff");

-- Per-phone position in the questionnaire chatbot flow.
CREATE TABLE "WhatsAppChatState" (
    "phone" VARCHAR(20) NOT NULL,
    "node" VARCHAR(60) NOT NULL DEFAULT 'root',
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppChatState_pkey" PRIMARY KEY ("phone")
);
