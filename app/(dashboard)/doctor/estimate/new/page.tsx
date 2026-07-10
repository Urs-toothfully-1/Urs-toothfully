import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { visitRepository } from "@/server/repositories/visit.repository"
import { prescriptionService } from "@/server/services/prescription.service"

type Props = { searchParams: Promise<{ visitId?: string; patientId?: string }> }

// Prescription-first flow: ensure only a prescription exists for this visit
// (NO estimate is created up front — the estimate is created lazily only if the
// doctor actually builds one), then open the consultation wizard.
export default async function NewEstimatePage({ searchParams }: Props) {
  const session = await requireRole(["ADMIN", "DOCTOR"])
  const { visitId, patientId } = await searchParams

  if (!visitId || !patientId) redirect("/doctor")

  const visit = await visitRepository.findById(visitId)
  if (!visit) redirect("/doctor")

  await prescriptionService.ensureForVisit(visitId, session.userId).catch(() => null)

  redirect(`/doctor/consultation/${visitId}`)
}
