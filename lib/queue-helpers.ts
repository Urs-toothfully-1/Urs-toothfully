import type { QueueStatus } from "@prisma/client"

export const QUEUE_STATUS_CONFIG: Record<
  QueueStatus,
  { label: string; color: string; bg: string }
> = {
  WAITING: { label: "Waiting", color: "#B45309", bg: "#FEF3C7" },
  WITH_DOCTOR: { label: "With Doctor", color: "#1D4ED8", bg: "#DBEAFE" },
  ESTIMATE_CREATED: { label: "Estimate Ready", color: "#6D28D9", bg: "#EDE9FE" },
  PAYMENT_PENDING: { label: "Payment Due", color: "#C2410C", bg: "#FFEDD5" },
  COMPLETED: { label: "Completed", color: "#065F46", bg: "#D1FAE5" },
  CANCELLED: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
}

export const VISIT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  TREATMENT_SESSION: "Treatment Session",
  FOLLOW_UP: "Follow-Up",
  EMERGENCY_VISIT: "Emergency",
  REVIEW: "Review",
}

export const NOTE_TYPE_LABELS: Record<string, string> = {
  EXAMINATION: "Examination",
  DIAGNOSIS: "Diagnosis",
  TREATMENT_NOTE: "Treatment Note",
  FOLLOW_UP: "Follow-Up",
  GENERAL: "General",
}

export function getTimeSince(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m ago`
}
