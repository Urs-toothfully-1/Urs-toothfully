import type { DentalHistory } from "@prisma/client"

export interface HealthAlert {
  label: string
  severity: "high" | "medium"
}

export function getHealthAlerts(history: DentalHistory | null): HealthAlert[] {
  if (!history) return []
  const alerts: HealthAlert[] = []

  if (history.diabetes) alerts.push({ label: "DIABETES", severity: "high" })
  if (history.bloodPressure && history.bloodPressureType === "HIGH")
    alerts.push({ label: "HIGH BP", severity: "high" })
  if (history.bloodPressure && history.bloodPressureType === "LOW")
    alerts.push({ label: "LOW BP", severity: "medium" })
  if (history.heartProblems) alerts.push({ label: "HEART PROBLEMS", severity: "high" })
  if (history.heartSurgery) alerts.push({ label: "HEART SURGERY", severity: "high" })
  if (history.epilepsy) alerts.push({ label: "EPILEPSY", severity: "high" })
  if (history.hivAids) alerts.push({ label: "HIV/AIDS", severity: "high" })
  if (history.hepatitis)
    alerts.push({
      label: `HEPATITIS${history.hepatitisType ? " " + history.hepatitisType : ""}`,
      severity: "high",
    })
  if (history.bleedsEasily) alerts.push({ label: "BLEEDS EASILY", severity: "high" })
  if (history.pregnant) alerts.push({ label: "PREGNANT", severity: "medium" })
  if (history.allergies) alerts.push({ label: "ALLERGIES", severity: "medium" })

  return alerts
}
