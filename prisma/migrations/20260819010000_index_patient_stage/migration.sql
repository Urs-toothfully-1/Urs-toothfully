-- Supports the consultation-paid check used to stage every patient in the list.
CREATE INDEX "Payment_patientId_paymentType_isDeleted_idx"
  ON "Payment"("patientId", "paymentType", "isDeleted");
