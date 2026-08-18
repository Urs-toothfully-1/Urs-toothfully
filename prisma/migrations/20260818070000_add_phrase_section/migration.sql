-- Clinical phrase library: `section` says which part of the prescription a
-- phrase belongs to. Existing rows are all diagnoses, which the default covers.
ALTER TABLE "Diagnosis" ADD COLUMN "section" VARCHAR(20) NOT NULL DEFAULT 'DIAGNOSIS';

-- Uniqueness is now per-section so a complaint and a diagnosis may share wording.
DROP INDEX "Diagnosis_branchId_name_key";
CREATE UNIQUE INDEX "Diagnosis_branchId_section_name_key" ON "Diagnosis"("branchId", "section", "name");

DROP INDEX "Diagnosis_branchId_specialty_isActive_isStandard_idx";
CREATE INDEX "Diagnosis_branchId_section_specialty_isActive_idx" ON "Diagnosis"("branchId", "section", "specialty", "isActive");
