import { prisma } from "@/lib/prisma"
import { prescriptionRepository } from "@/server/repositories/prescription.repository"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"
import { createAuditLog } from "@/lib/audit"
import { calculateAge, type PrescriptionData, type PrescriptionMedicine, type ExaminationFinding, type PrescriptionTreatment, type ClinicalNoteEntry } from "@/lib/prescription-types"
import type { DentalHistory } from "@prisma/client"
import { z } from "zod"

export const medicineSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).default(""),
  frequency: z.string().max(100).default(""),
  duration: z.string().max(100).default(""),
  instructions: z.string().max(300).optional(),
})

export const examinationFindingSchema = z.object({
  toothNumbers: z.string().max(200).default(""),
  finding: z.string().min(1).max(500),
})

export const treatmentPlanSchema = z.object({
  treatmentId: z.string().optional(),
  treatmentName: z.string().min(1).max(200),
  category: z.string().max(100).default("OTHER"),
  toothNumber: z.string().max(200).optional(),
  quantity: z.number().int().min(1).max(99).default(1),
})

export const clinicalNoteSchema = z.object({
  date: z.string().max(10),
  note: z.string().max(2000),
})

export const updatePrescriptionSchema = z.object({
  chiefComplaint: z.string().max(500).default(""),
  onExamination: z.array(examinationFindingSchema).max(20).default([]),
  treatments: z.array(treatmentPlanSchema).max(40).default([]),
  medicines: z.array(medicineSchema).max(30),
  advice: z.string().max(2000).default(""),
  followUpDate: z.string().optional(),
  clinicalNotes: z.array(clinicalNoteSchema).max(100).default([]),
})

export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>

/** Summarises the clinically significant flags of a dental history. */
export function buildMedicalAlerts(h: DentalHistory | null): string[] {
  if (!h) return []
  const alerts: string[] = []
  if (h.allergies) alerts.push(`Allergies${h.allergiesDetail ? `: ${h.allergiesDetail}` : ""}`)
  if (h.diabetes) alerts.push("Diabetes")
  if (h.epilepsy) alerts.push(`Epilepsy / Seizures${h.epilepsyDetail ? `: ${h.epilepsyDetail}` : ""}`)
  if (h.hepatitis) alerts.push(`Hepatitis${h.hepatitisType ? ` (Type ${h.hepatitisType})` : ""}`)
  if (h.hivAids) alerts.push("HIV / AIDS")
  if (h.heartProblems) alerts.push(`Heart Problems${h.heartProblemsDetail ? `: ${h.heartProblemsDetail}` : ""}`)
  if (h.heartSurgery) alerts.push(`Heart Surgery${h.heartSurgeryDetail ? `: ${h.heartSurgeryDetail}` : ""}`)
  if (h.bloodPressure) alerts.push(`Blood Pressure${h.bloodPressureType ? ` (${h.bloodPressureType})` : ""}`)
  if (h.kidneyLiver) alerts.push("Kidney / Liver Disease")
  if (h.respiratory) alerts.push("Respiratory / Asthma")
  if (h.bleedsEasily) alerts.push("Bleeds Easily / Clotting Disorder")
  if (h.pregnant) alerts.push("Pregnant / Nursing")
  if (h.currentMedications) alerts.push(`Medications: ${h.currentMedications}`)
  return alerts
}

export const prescriptionService = {
  async getById(id: string) {
    return prescriptionRepository.findById(id)
  },

  async getByVisit(visitId: string) {
    return prescriptionRepository.findByVisit(visitId)
  },

  /**
   * Auto-creates the prescription when an estimate is saved. The snapshot
   * carries patient details, dental-history alerts, and the estimate's
   * treatments — with no prices.
   */
  async createFromEstimate(estimateId: string, createdById: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        patient: {
          select: { id: true, patientId: true, fullName: true, dateOfBirth: true, gender: true, mobile: true },
        },
        doctor: { select: { id: true, name: true, doctorRegNo: true } },
        branch: { select: { name: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    })
    if (!estimate) throw new Error("Estimate not found")

    // One prescription per visit — reuse if it already exists
    const existing = await prescriptionRepository.findByVisit(estimate.visitId)
    if (existing) return existing

    const history = await dentalHistoryRepository.findLatestByPatient(estimate.patientId)

    const data: PrescriptionData = {
      patient: {
        name: estimate.patient.fullName,
        patientId: estimate.patient.patientId,
        age: calculateAge(estimate.patient.dateOfBirth),
        gender: estimate.patient.gender,
        mobile: estimate.patient.mobile,
      },
      medicalAlerts: buildMedicalAlerts(history),
      treatments: estimate.items.map((item) => ({
        treatmentName: item.treatmentName,
        category: item.category,
        toothNumber: item.toothNumber ?? undefined,
        quantity: item.quantity,
      })),
      doctorName: estimate.doctor.name,
      doctorRegNo: estimate.doctor.doctorRegNo ?? undefined,
      branchName: estimate.branch.name,
      estimateNo: estimate.estimateNo,
      date: new Date().toISOString(),
      medicines: [],
      advice: "",
    }

    const prescription = await prescriptionRepository.create({
      patientId: estimate.patientId,
      visitId: estimate.visitId,
      doctorId: estimate.doctorId,
      mode: "PARTIAL_DIGITAL",
      prescriptionData: JSON.parse(JSON.stringify(data)),
    })

    await createAuditLog({
      entityType: "PrescriptionRecord",
      entityId: prescription.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { estimateNo: estimate.estimateNo, treatments: data.treatments.length },
      branchId: estimate.branchId,
    })

    return prescription
  },

  /**
   * Builds the prescription snapshot for a visit WITHOUT persisting it — used to
   * render a blank "new prescription" form so nothing is saved until the doctor
   * actually enters data.
   */
  async buildDraftForVisit(visitId: string): Promise<PrescriptionData | null> {
    const visit = await prisma.patientVisit.findUnique({
      where: { id: visitId },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, dateOfBirth: true, gender: true, mobile: true } },
        doctor: { select: { name: true, doctorRegNo: true } },
        branch: { select: { name: true } },
      },
    })
    if (!visit) return null
    const history = await dentalHistoryRepository.findLatestByPatient(visit.patientId)
    return {
      patient: {
        name: visit.patient.fullName,
        patientId: visit.patient.patientId,
        age: calculateAge(visit.patient.dateOfBirth),
        gender: visit.patient.gender,
        mobile: visit.patient.mobile,
      },
      medicalAlerts: buildMedicalAlerts(history),
      treatments: [],
      doctorName: visit.doctor?.name ?? "",
      doctorRegNo: visit.doctor?.doctorRegNo ?? undefined,
      branchName: visit.branch.name,
      date: new Date().toISOString(),
      medicines: [],
      advice: "",
    }
  },

  /**
   * Ensures a prescription exists for ANY visit (e.g. a treatment session, where
   * there is no estimate to snapshot). Reuses an existing one; otherwise creates a
   * fresh prescription from patient details + dental-history alerts.
   */
  async ensureForVisit(visitId: string, createdById: string) {
    const existing = await prescriptionRepository.findByVisit(visitId)
    if (existing) return existing

    const visit = await prisma.patientVisit.findUnique({
      where: { id: visitId },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, dateOfBirth: true, gender: true, mobile: true } },
        doctor: { select: { id: true, name: true, doctorRegNo: true } },
        branch: { select: { name: true } },
      },
    })
    if (!visit || !visit.doctorId) throw new Error("Visit not found or has no assigned doctor")

    const history = await dentalHistoryRepository.findLatestByPatient(visit.patientId)

    const data: PrescriptionData = {
      patient: {
        name: visit.patient.fullName,
        patientId: visit.patient.patientId,
        age: calculateAge(visit.patient.dateOfBirth),
        gender: visit.patient.gender,
        mobile: visit.patient.mobile,
      },
      medicalAlerts: buildMedicalAlerts(history),
      treatments: [],
      doctorName: visit.doctor?.name ?? "",
      doctorRegNo: visit.doctor?.doctorRegNo ?? undefined,
      branchName: visit.branch.name,
      date: new Date().toISOString(),
      medicines: [],
      advice: "",
    }

    const prescription = await prescriptionRepository.create({
      patientId: visit.patientId,
      visitId,
      doctorId: visit.doctorId,
      mode: "PARTIAL_DIGITAL",
      prescriptionData: JSON.parse(JSON.stringify(data)),
    })

    await createAuditLog({
      entityType: "PrescriptionRecord",
      entityId: prescription.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { visitNo: visit.visitNo },
      branchId: visit.branchId,
    })

    return prescription
  },

  /** Appends/replaces just the clinical-notes log, leaving the rest of the Rx intact. */
  async updateClinicalNotes(id: string, notes: ClinicalNoteEntry[], updatedById: string) {
    const record = await prescriptionRepository.findById(id)
    if (!record) throw new Error("Prescription not found")
    const current = (record.prescriptionData ?? {}) as unknown as PrescriptionData
    const updated: PrescriptionData = {
      ...current,
      clinicalNotes: notes.filter((n) => n.note.trim()),
    }
    const result = await prescriptionRepository.updateData(id, JSON.parse(JSON.stringify(updated)))
    await createAuditLog({
      entityType: "PrescriptionRecord",
      entityId: id,
      action: "UPDATE",
      changedById: updatedById,
      newValues: { clinicalNotes: updated.clinicalNotes?.length ?? 0 },
    })
    return result
  },

  /** Doctor edits chief complaint, examination findings, medicines, advice, follow-up. */
  async update(id: string, input: UpdatePrescriptionInput, updatedById: string) {
    const record = await prescriptionRepository.findById(id)
    if (!record) throw new Error("Prescription not found")

    const current = (record.prescriptionData ?? {}) as unknown as PrescriptionData
    const updated: PrescriptionData = {
      ...current,
      chiefComplaint: input.chiefComplaint || undefined,
      onExamination: (input.onExamination as ExaminationFinding[]).filter((f) => f.finding.trim()),
      treatments: (input.treatments as PrescriptionTreatment[]).filter((t) => t.treatmentName.trim()),
      medicines: input.medicines as PrescriptionMedicine[],
      advice: input.advice,
      followUpDate: input.followUpDate || undefined,
      clinicalNotes: (input.clinicalNotes as ClinicalNoteEntry[]).filter((n) => n.note.trim()),
    }

    const result = await prescriptionRepository.updateData(id, JSON.parse(JSON.stringify(updated)))

    await createAuditLog({
      entityType: "PrescriptionRecord",
      entityId: id,
      action: "UPDATE",
      changedById: updatedById,
      newValues: { medicines: input.medicines.length, hasAdvice: !!input.advice },
    })

    return result
  },
}
