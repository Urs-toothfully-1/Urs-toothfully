/**
 * Shape of PrescriptionRecord.prescriptionData (Json column).
 * Snapshot is taken when the estimate is created; the doctor then adds
 * medicines/advice. Treatment entries deliberately carry NO pricing.
 */

export interface PrescriptionMedicine {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

export interface PrescriptionTreatment {
  treatmentName: string
  category: string
  toothNumber?: string
  quantity: number
}

export interface ExaminationFinding {
  toothNumbers: string   // comma-separated FDI numbers, or "" for general
  finding: string
}

export interface PrescriptionData {
  patient: {
    name: string
    patientId: string
    age: number
    gender: string
    mobile: string
  }
  medicalAlerts: string[]
  /** Treatment plan snapshot (from estimate) — kept for reference, not shown in print */
  treatments: PrescriptionTreatment[]
  doctorName: string
  doctorRegNo?: string
  branchName: string
  estimateNo?: string
  date: string
  /** Doctor's own written chief complaint */
  chiefComplaint?: string
  /** Doctor's clinical examination findings, each optionally linked to tooth numbers */
  onExamination?: ExaminationFinding[]
  medicines: PrescriptionMedicine[]
  advice: string
  followUpDate?: string
}

export function calculateAge(dateOfBirth: Date | string): number {
  return Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )
}
