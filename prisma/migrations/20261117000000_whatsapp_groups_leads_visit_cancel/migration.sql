-- AlterTable
ALTER TABLE "PatientVisit" ADD COLUMN     "cancelReason" VARCHAR(300),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT;

-- AlterTable
ALTER TABLE "PotentialClient" ADD COLUMN     "enquiry" VARCHAR(200),
ADD COLUMN     "followUpOn" DATE,
ADD COLUMN     "lastMessage" VARCHAR(1000);

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppGroup" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroup_name_key" ON "WhatsAppGroup"("name");

-- CreateIndex
CREATE INDEX "WhatsAppGroupMember_patientId_idx" ON "WhatsAppGroupMember"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroupMember_groupId_patientId_key" ON "WhatsAppGroupMember"("groupId", "patientId");

-- CreateIndex
CREATE INDEX "PotentialClient_followUpOn_idx" ON "PotentialClient"("followUpOn");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_groupId_createdAt_idx" ON "WhatsAppMessage"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsAppGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroup" ADD CONSTRAINT "WhatsAppGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupMember" ADD CONSTRAINT "WhatsAppGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsAppGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupMember" ADD CONSTRAINT "WhatsAppGroupMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

