-- AlterTable
ALTER TABLE "AppointmentRequest" ADD COLUMN     "consentIp" VARCHAR(45),
ADD COLUMN     "whatsappConsent" BOOLEAN NOT NULL DEFAULT false;

