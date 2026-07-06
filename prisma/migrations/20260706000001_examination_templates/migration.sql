-- CreateTable: ExaminationTemplate
-- Stores reusable clinical examination finding templates per doctor.

CREATE TABLE "ExaminationTemplate" (
    "id"        TEXT NOT NULL,
    "doctorId"  TEXT NOT NULL,
    "name"      VARCHAR(100) NOT NULL,
    "finding"   VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExaminationTemplate_doctorId_idx" ON "ExaminationTemplate"("doctorId");

ALTER TABLE "ExaminationTemplate"
    ADD CONSTRAINT "ExaminationTemplate_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
