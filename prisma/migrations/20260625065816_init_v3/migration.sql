-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DOCTOR', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('CONSULTATION', 'TREATMENT_SESSION', 'FOLLOW_UP', 'EMERGENCY_VISIT', 'REVIEW');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'WITH_DOCTOR', 'ESTIMATE_CREATED', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CONSULTATION', 'TREATMENT', 'ADVANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('RECEIPT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AccountingStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT', 'STATUS_CHANGE', 'CLAIM', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'EXCEL');

-- CreateEnum
CREATE TYPE "PrescriptionMode" AS ENUM ('PRINT_ONLY', 'PARTIAL_DIGITAL', 'FULL_DIGITAL');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "doctorRegNo" VARCHAR(20),
    "doctorQualification" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "workingDays" VARCHAR(50) NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientId" VARCHAR(20) NOT NULL,
    "registrationBranchId" TEXT NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(100),
    "address" TEXT,
    "leadSource" VARCHAR(100),
    "referenceName" VARCHAR(200),
    "reasonForVisit" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DentalHistory" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "allergies" BOOLEAN NOT NULL DEFAULT false,
    "allergiesDetail" TEXT,
    "diabetes" BOOLEAN NOT NULL DEFAULT false,
    "epilepsy" BOOLEAN NOT NULL DEFAULT false,
    "epilepsyDetail" TEXT,
    "fainting" BOOLEAN NOT NULL DEFAULT false,
    "hepatitis" BOOLEAN NOT NULL DEFAULT false,
    "hepatitisType" VARCHAR(10),
    "hivAids" BOOLEAN NOT NULL DEFAULT false,
    "heartProblems" BOOLEAN NOT NULL DEFAULT false,
    "heartProblemsDetail" TEXT,
    "heartSurgery" BOOLEAN NOT NULL DEFAULT false,
    "heartSurgeryDetail" TEXT,
    "bloodPressure" BOOLEAN NOT NULL DEFAULT false,
    "bloodPressureType" VARCHAR(20),
    "kidneyLiver" BOOLEAN NOT NULL DEFAULT false,
    "respiratory" BOOLEAN NOT NULL DEFAULT false,
    "sinus" BOOLEAN NOT NULL DEFAULT false,
    "bleedsEasily" BOOLEAN NOT NULL DEFAULT false,
    "smoker" BOOLEAN NOT NULL DEFAULT false,
    "pregnant" BOOLEAN NOT NULL DEFAULT false,
    "currentMedications" TEXT,
    "otherDisease" TEXT,
    "generalHealthNotes" TEXT,
    "dentalReasonForVisit" TEXT,
    "previousTreatment" TEXT,
    "lastDentistVisit" VARCHAR(100),
    "lastXRay" VARCHAR(100),
    "foodCatching" BOOLEAN NOT NULL DEFAULT false,
    "gumsBleed" BOOLEAN NOT NULL DEFAULT false,
    "looseTeeth" BOOLEAN NOT NULL DEFAULT false,
    "sensitiveTeeth" BOOLEAN NOT NULL DEFAULT false,
    "grinding" BOOLEAN NOT NULL DEFAULT false,
    "jawPain" BOOLEAN NOT NULL DEFAULT false,
    "snoring" BOOLEAN NOT NULL DEFAULT false,
    "appearanceConcern" BOOLEAN NOT NULL DEFAULT false,
    "seenSpecialist" BOOLEAN NOT NULL DEFAULT false,
    "wisdomTeethRemoved" BOOLEAN NOT NULL DEFAULT false,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DentalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientVisit" (
    "id" TEXT NOT NULL,
    "visitNo" VARCHAR(20) NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT,
    "visitType" "VisitType" NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chiefComplaint" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT,
    "tokenNumber" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "noteType" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionTemplate" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "mode" "PrescriptionMode" NOT NULL DEFAULT 'PRINT_ONLY',
    "headerImagePath" TEXT,
    "footerImagePath" TEXT,
    "bodyTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "templateId" TEXT,
    "mode" "PrescriptionMode" NOT NULL DEFAULT 'PRINT_ONLY',
    "prescriptionData" JSONB,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentMaster" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "defaultAmount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "TreatmentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPackage" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "packagePrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TreatmentPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "estimateNo" VARCHAR(20) NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "advanceRequired" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),
    "notes" TEXT,
    "status" "EstimateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateItem" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "treatmentName" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "toothNumber" VARCHAR(20),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitRate" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "statusUpdatedAt" TIMESTAMP(3),
    "statusUpdatedById" TEXT,

    CONSTRAINT "EstimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "estimateId" TEXT,
    "visitId" TEXT,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "transactionRef" VARCHAR(100),
    "notes" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNo" VARCHAR(20) NOT NULL,
    "paymentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingEntry" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "entryType" "EntryType" NOT NULL DEFAULT 'RECEIPT',
    "status" "AccountingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "exportBatchId" TEXT,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "documentType" VARCHAR(50) NOT NULL,
    "patientId" TEXT NOT NULL,
    "estimateId" TEXT,
    "receiptId" TEXT,
    "prescriptionId" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "mimeType" VARCHAR(50) DEFAULT 'application/pdf',

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(36) NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousValues" JSONB,
    "newValues" JSONB,
    "reason" TEXT,
    "branchId" VARCHAR(36),
    "ipAddress" VARCHAR(45),

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportBatch" (
    "id" TEXT NOT NULL,
    "batchNo" VARCHAR(20) NOT NULL,
    "branchId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "exportedById" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "format" "ExportFormat" NOT NULL,
    "filePath" TEXT,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "documentType" VARCHAR(50) NOT NULL,
    "fileName" VARCHAR(200) NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" VARCHAR(100),
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PatientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientMergeLog" (
    "id" TEXT NOT NULL,
    "primaryPatientId" TEXT NOT NULL,
    "mergedPatientId" VARCHAR(20) NOT NULL,
    "mergedPatientName" VARCHAR(200) NOT NULL,
    "mergedById" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PatientMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DoctorAvailability_branchId_isActive_idx" ON "DoctorAvailability"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAvailability_doctorId_branchId_key" ON "DoctorAvailability"("doctorId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientId_key" ON "Patient"("patientId");

-- CreateIndex
CREATE INDEX "Patient_mobile_idx" ON "Patient"("mobile");

-- CreateIndex
CREATE INDEX "Patient_registrationBranchId_createdAt_idx" ON "Patient"("registrationBranchId", "createdAt");

-- CreateIndex
CREATE INDEX "DentalHistory_patientId_isLatest_idx" ON "DentalHistory"("patientId", "isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "PatientVisit_visitNo_key" ON "PatientVisit"("visitNo");

-- CreateIndex
CREATE INDEX "PatientVisit_patientId_visitDate_idx" ON "PatientVisit"("patientId", "visitDate");

-- CreateIndex
CREATE INDEX "PatientVisit_branchId_visitDate_idx" ON "PatientVisit"("branchId", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_visitId_key" ON "QueueEntry"("visitId");

-- CreateIndex
CREATE INDEX "QueueEntry_branchId_status_createdAt_idx" ON "QueueEntry"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "QueueEntry_doctorId_status_idx" ON "QueueEntry"("doctorId", "status");

-- CreateIndex
CREATE INDEX "ClinicalNote_patientId_createdAt_idx" ON "ClinicalNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_visitId_idx" ON "ClinicalNote"("visitId");

-- CreateIndex
CREATE INDEX "PrescriptionRecord_patientId_createdAt_idx" ON "PrescriptionRecord"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionRecord_visitId_idx" ON "PrescriptionRecord"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNo_key" ON "Estimate"("estimateNo");

-- CreateIndex
CREATE INDEX "Estimate_patientId_status_idx" ON "Estimate"("patientId", "status");

-- CreateIndex
CREATE INDEX "Estimate_branchId_createdAt_idx" ON "Estimate"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Estimate_visitId_idx" ON "Estimate"("visitId");

-- CreateIndex
CREATE INDEX "Payment_estimateId_idx" ON "Payment"("estimateId");

-- CreateIndex
CREATE INDEX "Payment_visitId_idx" ON "Payment"("visitId");

-- CreateIndex
CREATE INDEX "Payment_patientId_paymentDate_idx" ON "Payment"("patientId", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_branchId_paymentDate_idx" ON "Payment"("branchId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNo_key" ON "Receipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingEntry_paymentId_key" ON "AccountingEntry"("paymentId");

-- CreateIndex
CREATE INDEX "AccountingEntry_branchId_entryDate_status_idx" ON "AccountingEntry"("branchId", "entryDate", "status");

-- CreateIndex
CREATE INDEX "AccountingEntry_exportBatchId_idx" ON "AccountingEntry"("exportBatchId");

-- CreateIndex
CREATE INDEX "AccountingEntry_paymentType_entryDate_idx" ON "AccountingEntry"("paymentType", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_receiptId_key" ON "GeneratedDocument"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_prescriptionId_key" ON "GeneratedDocument"("prescriptionId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_patientId_documentType_generatedAt_idx" ON "GeneratedDocument"("patientId", "documentType", "generatedAt");

-- CreateIndex
CREATE INDEX "GeneratedDocument_estimateId_idx" ON "GeneratedDocument"("estimateId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_changedById_changedAt_idx" ON "AuditLog"("changedById", "changedAt");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_changedAt_idx" ON "AuditLog"("branchId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExportBatch_batchNo_key" ON "ExportBatch"("batchNo");

-- CreateIndex
CREATE INDEX "PatientDocument_patientId_idx" ON "PatientDocument"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientMergeLog_primaryPatientId_key" ON "PatientMergeLog"("primaryPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_branchId_key_key" ON "SystemSetting"("branchId", "key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_registrationBranchId_fkey" FOREIGN KEY ("registrationBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalHistory" ADD CONSTRAINT "DentalHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalHistory" ADD CONSTRAINT "DentalHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionTemplate" ADD CONSTRAINT "PrescriptionTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionTemplate" ADD CONSTRAINT "PrescriptionTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRecord" ADD CONSTRAINT "PrescriptionRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRecord" ADD CONSTRAINT "PrescriptionRecord_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRecord" ADD CONSTRAINT "PrescriptionRecord_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRecord" ADD CONSTRAINT "PrescriptionRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PrescriptionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentMaster" ADD CONSTRAINT "TreatmentMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentMaster" ADD CONSTRAINT "TreatmentMaster_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPackage" ADD CONSTRAINT "TreatmentPackage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPackageItem" ADD CONSTRAINT "TreatmentPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPackageItem" ADD CONSTRAINT "TreatmentPackageItem_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "TreatmentMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "TreatmentMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_exportBatchId_fkey" FOREIGN KEY ("exportBatchId") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "PrescriptionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDocument" ADD CONSTRAINT "PatientDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMergeLog" ADD CONSTRAINT "PatientMergeLog_primaryPatientId_fkey" FOREIGN KEY ("primaryPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMergeLog" ADD CONSTRAINT "PatientMergeLog_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
