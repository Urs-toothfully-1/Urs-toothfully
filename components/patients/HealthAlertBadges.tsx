import { getHealthAlerts } from "@/lib/patient-alerts"
import type { DentalHistory } from "@prisma/client"

interface Props {
  history: DentalHistory | null
}

export function HealthAlertBadges({ history }: Props) {
  const alerts = getHealthAlerts(history)
  if (alerts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {alerts.map((alert) => (
        <span
          key={alert.label}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide"
          style={{
            backgroundColor: alert.severity === "high" ? "#FEE2E2" : "#FEF9C3",
            color: alert.severity === "high" ? "#B91C1C" : "#854D0E",
          }}
        >
          ⚠ {alert.label}
        </span>
      ))}
    </div>
  )
}
