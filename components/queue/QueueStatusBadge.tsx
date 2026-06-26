import { QUEUE_STATUS_CONFIG } from "@/lib/queue-helpers"
import type { QueueStatus } from "@prisma/client"

export function QueueStatusBadge({ status }: { status: QueueStatus }) {
  const cfg = QUEUE_STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}
