-- CreateTable
CREATE TABLE "PaymentAgreement" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "clinicRepresentative" VARCHAR(200),
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "patientSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAgreement_estimateId_key" ON "PaymentAgreement"("estimateId");

-- AddForeignKey
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
