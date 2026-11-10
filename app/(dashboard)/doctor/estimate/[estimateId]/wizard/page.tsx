import { notFound, redirect } from "next/navigation"
import { assertPatientInScope } from "@/server/services/patient-scope.service"
import { getSession } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"

type Props = { params: Promise<{ estimateId: string }> }

// The wizard is now visit-based (prescription-first, lazy estimate). This route
// stays as an alias so existing links (e.g. from the treatment session page)
// keep working — it forwards to the consultation wizard for the estimate's visit.
export default async function EstimateWizardRedirect({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role === "RECEPTIONIST") redirect("/reception")
  if (!session.perms.estimates) notFound()

  const { estimateId } = await params
  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) notFound()
  await assertPatientInScope(session, estimate.patientId)

  redirect(`/doctor/consultation/${estimate.visitId}`)
}
