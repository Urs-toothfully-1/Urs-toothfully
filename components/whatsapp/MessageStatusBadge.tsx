import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
  PROCESSING: { bg: "#DBEAFE", text: "#1E40AF", label: "Processing" },
  SENT: { bg: "#CFE5FF", text: "#005E97", label: "Sent" },
  DELIVERED: { bg: "#D1FAE5", text: "#065F46", label: "Delivered" },
  READ: { bg: "#A7F3D0", text: "#064E3B", label: "Read" },
  FAILED: { bg: "#FEE2E2", text: "#991B1B", label: "Failed" },
  RETRY: { bg: "#FEF3C7", text: "#B45309", label: "Retrying" },
  CANCELLED: { bg: "#F3F4F6", text: "#4B5563", label: "Cancelled" },
}

export function MessageStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "#F3F4F6", text: "#4B5563", label: status }
  return (
    <Badge className="border-0 font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </Badge>
  )
}
