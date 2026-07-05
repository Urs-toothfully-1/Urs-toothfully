"use client"

import { useTransition } from "react"
import Link from "next/link"
import { QueueStatusBadge } from "@/components/queue/QueueStatusBadge"
import { VISIT_TYPE_LABELS, getTimeSince } from "@/lib/queue-helpers"
import { updateQueueStatusAction, claimPatientAction } from "@/actions/queue"
import { Loader2, Stethoscope, CheckCircle2, CreditCard, XCircle, UserCheck, FilePlus, Phone } from "lucide-react"
import { toast } from "sonner"
import type { QueueStatus } from "@prisma/client"
import type { Role } from "@/lib/session"

interface QueueEntry {
  id: string
  visitId: string
  tokenNumber: number
  status: QueueStatus
  sentAt: Date | string
  patient: { id: string; patientId: string; fullName: string; mobile: string }
  doctor: { id: string; name: string } | null
  visit: { id: string; visitNo: string; visitType: string; chiefComplaint?: string | null }
  doctorId: string | null
}

interface Props {
  entry: QueueEntry
  role: Role
  currentUserId: string
}

const TOKEN_COLORS: Record<string, { bg: string; text: string }> = {
  WAITING: { bg: "#FEF3C7", text: "#92400E" },
  WITH_DOCTOR: { bg: "#DBEAFE", text: "#1E40AF" },
  ESTIMATE_CREATED: { bg: "#EDE9FE", text: "#5B21B6" },
  PAYMENT_PENDING: { bg: "#FFEDD5", text: "#9A3412" },
  COMPLETED: { bg: "#D1FAE5", text: "#065F46" },
  CANCELLED: { bg: "#F2F4F6", text: "#707882" },
}

export function QueueEntryCard({ entry, role, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()

  const isDoctor = role === "DOCTOR"
  const isReception = role === "RECEPTIONIST" || role === "ADMIN"
  const isMyPatient = entry.doctorId === currentUserId
  const isActive = !["COMPLETED", "CANCELLED"].includes(entry.status)
  const tokenColors = TOKEN_COLORS[entry.status] ?? TOKEN_COLORS.WAITING

  function handleStatusUpdate(newStatus: string) {
    startTransition(async () => {
      const result = await updateQueueStatusAction(entry.id, newStatus)
      if (!result.success) toast.error(result.error ?? "Failed to update")
      else toast.success("Status updated")
    })
  }

  function handleClaim() {
    startTransition(async () => {
      const result = await claimPatientAction(entry.id)
      if (!result.success) toast.error(result.error ?? "Failed to claim")
      else toast.success("Patient claimed")
    })
  }

  return (
    <div
      className="bg-white rounded-xl border p-4 flex items-start gap-4 transition-all"
      style={{
        borderColor: isActive ? "#E0E3E5" : "#F2F4F6",
        opacity: isActive ? 1 : 0.6,
        boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.04)" : "none",
      }}
    >
      {/* Token bubble */}
      <div
        className="flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: tokenColors.bg, color: tokenColors.text }}
      >
        {entry.tokenNumber}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/patients/${entry.patient.id}`}
                className="font-semibold text-sm hover:underline transition-colors"
                style={{ color: "#191C1E" }}
              >
                {entry.patient.fullName}
              </Link>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#F2F4F6", color: "#005E97" }}>
                {entry.patient.patientId}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-xs font-medium" style={{ color: "#404751" }}>
                {VISIT_TYPE_LABELS[entry.visit.visitType] ?? entry.visit.visitType}
              </span>
              {entry.doctor && (
                <span className="text-xs" style={{ color: "#707882" }}>
                  → {entry.doctor.name}
                </span>
              )}
              <span className="text-xs" style={{ color: "#707882" }}>
                {getTimeSince(entry.sentAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Phone className="h-3 w-3" style={{ color: "#707882" }} />
              <span className="text-xs" style={{ color: "#707882" }}>{entry.patient.mobile}</span>
            </div>
            {entry.visit.chiefComplaint && (
              <p className="text-xs mt-1 truncate italic" style={{ color: "#707882" }}>
                &ldquo;{entry.visit.chiefComplaint}&rdquo;
              </p>
            )}
          </div>
          <QueueStatusBadge status={entry.status} />
        </div>
      </div>

      {/* Action buttons */}
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 mt-1" style={{ color: "#707882" }} />
      ) : (
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {entry.status === "WAITING" && isDoctor && !entry.doctorId && (
            <button
              onClick={handleClaim}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "linear-gradient(135deg,#005E97,#0077BE)", boxShadow: "0 2px 8px rgba(14,165,233,0.3)" }}
            >
              <UserCheck className="h-3.5 w-3.5" />Claim
            </button>
          )}
          {entry.status === "WAITING" && isDoctor && isMyPatient && (
            <button
              onClick={() => handleStatusUpdate("WITH_DOCTOR")}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ background: "linear-gradient(135deg,#005E97,#0077BE)" }}
            >
              <Stethoscope className="h-3.5 w-3.5" />Start
            </button>
          )}
          {entry.status === "WITH_DOCTOR" && isDoctor && isMyPatient && (
            <>
              <Link
                href={`/doctor/estimate/new?visitId=${entry.visitId}&patientId=${entry.patient.id}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                style={{ background: "linear-gradient(135deg,#005E97,#0077BE)" }}
              >
                <FilePlus className="h-3.5 w-3.5" />Estimate
              </Link>
              <button
                onClick={() => handleStatusUpdate("ESTIMATE_CREATED")}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "#7C3AED" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />Done
              </button>
            </>
          )}
          {entry.status === "ESTIMATE_CREATED" && isReception && (
            <Link
              href={`/reception/collect-payment?patientId=${entry.patient.id}&visitId=${entry.visitId}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "#C2410C" }}
            >
              <CreditCard className="h-3.5 w-3.5" />Collect
            </Link>
          )}
          {entry.status === "PAYMENT_PENDING" && isReception && (
            <button
              onClick={() => handleStatusUpdate("COMPLETED")}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "#006B5F" }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />Complete
            </button>
          )}
          {isReception && isActive && !["COMPLETED", "CANCELLED"].includes(entry.status) && (
            <button
              onClick={() => handleStatusUpdate("CANCELLED")}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-red-50"
              style={{ color: "#EF4444", borderColor: "#FECACA" }}
            >
              <XCircle className="h-3.5 w-3.5" />Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
