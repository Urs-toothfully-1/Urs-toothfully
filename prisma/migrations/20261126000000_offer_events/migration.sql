-- Event offers (Black Friday etc.): additive only.
CREATE TABLE "OfferEvent" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "tiers" JSONB NOT NULL,
    "terms" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientOffer" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "offer" VARCHAR(200) NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "givenAt" TIMESTAMP(3),
    "givenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfferEvent_isActive_startsAt_idx" ON "OfferEvent"("isActive", "startsAt");
CREATE UNIQUE INDEX "PatientOffer_patientId_eventId_key" ON "PatientOffer"("patientId", "eventId");
CREATE INDEX "PatientOffer_eventId_givenAt_idx" ON "PatientOffer"("eventId", "givenAt");

ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientOffer" ADD CONSTRAINT "PatientOffer_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientOffer" ADD CONSTRAINT "PatientOffer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OfferEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientOffer" ADD CONSTRAINT "PatientOffer_givenById_fkey" FOREIGN KEY ("givenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
