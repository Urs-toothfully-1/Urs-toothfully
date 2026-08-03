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
  /** Optional link to TreatmentMaster so the estimate step can pull the default rate */
  treatmentId?: string
}

export interface ExaminationFinding {
  toothNumbers: string   // comma-separated FDI numbers, or "" for general
  finding: string
}

/** Dated note of what the doctor did — accumulates across visits, printed after Rx. */
export interface ClinicalNoteEntry {
  date: string  // "YYYY-MM-DD"
  note: string
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
  /** Doctor's diagnosis — printed in the DIAGNOSIS block of the pad */
  diagnosis?: string
  medicines: PrescriptionMedicine[]
  advice: string
  followUpDate?: string
  /** Doctor's dated clinical notes (what was done), shown/printed after the Rx */
  clinicalNotes?: ClinicalNoteEntry[]
}

export function calculateAge(dateOfBirth: Date | string): number {
  return Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )
}
