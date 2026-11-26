-- Event offer booking log (counter + "first N patients"). Additive only.
CREATE TABLE "OfferClaim" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tierIndex" INTEGER NOT NULL,
    "offer" VARCHAR(200) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "requestId" TEXT,
    "patientId" TEXT,
    CONSTRAINT "OfferClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfferClaim_requestId_key" ON "OfferClaim"("requestId");
CREATE INDEX "OfferClaim_eventId_at_idx" ON "OfferClaim"("eventId", "at");
CREATE INDEX "OfferClaim_eventId_mobile_idx" ON "OfferClaim"("eventId", "mobile");

ALTER TABLE "OfferClaim" ADD CONSTRAINT "OfferClaim_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OfferEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
