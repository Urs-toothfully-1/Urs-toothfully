-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "specialty" VARCHAR(100) NOT NULL,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionDiagnosis" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "diagnosisId" TEXT,
    "diagnosisText" VARCHAR(500) NOT NULL,
    "specialty" VARCHAR(100),
    "toothNumbers" VARCHAR(120),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisUsage" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineTemplate" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "medicine" VARCHAR(300) NOT NULL,
    "frequency" VARCHAR(20) NOT NULL,
    "duration" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MedicineTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Diagnosis_branchId_specialty_isActive_isStandard_idx" ON "Diagnosis"("branchId", "specialty", "isActive", "isStandard");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnosis_branchId_name_key" ON "Diagnosis"("branchId", "name");

-- CreateIndex
CREATE INDEX "PrescriptionDiagnosis_prescriptionId_idx" ON "PrescriptionDiagnosis"("prescriptionId");

-- CreateIndex
CREATE INDEX "PrescriptionDiagnosis_diagnosisId_idx" ON "PrescriptionDiagnosis"("diagnosisId");

-- CreateIndex
CREATE INDEX "PrescriptionDiagnosis_prescriptionId_createdAt_idx" ON "PrescriptionDiagnosis"("prescriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "DiagnosisUsage_doctorId_usedAt_idx" ON "DiagnosisUsage"("doctorId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisUsage_doctorId_diagnosisId_key" ON "DiagnosisUsage"("doctorId", "diagnosisId");

-- CreateIndex
CREATE INDEX "Medicine_branchId_category_isActive_idx" ON "Medicine"("branchId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_branchId_name_key" ON "Medicine"("branchId", "name");

-- CreateIndex
CREATE INDEX "MedicineTemplate_branchId_idx" ON "MedicineTemplate"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineTemplate_branchId_name_key" ON "MedicineTemplate"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineTemplateItem_templateId_medicine_key" ON "MedicineTemplateItem"("templateId", "medicine");

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionDiagnosis" ADD CONSTRAINT "PrescriptionDiagnosis_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "PrescriptionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionDiagnosis" ADD CONSTRAINT "PrescriptionDiagnosis_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisUsage" ADD CONSTRAINT "DiagnosisUsage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisUsage" ADD CONSTRAINT "DiagnosisUsage_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisUsage" ADD CONSTRAINT "DiagnosisUsage_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineTemplate" ADD CONSTRAINT "MedicineTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineTemplateItem" ADD CONSTRAINT "MedicineTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MedicineTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
