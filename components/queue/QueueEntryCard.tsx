"use client"

import { useTransition } from "react"
import Link from "next/link"
import { QueueStatusBadge } from "@/components/queue/QueueStatusBadge"
import { BRAND_COLORS } from "@/lib/constants"
import { VISIT_TYPE_LABELS, getTimeSince } from "@/lib/queue-helpers"
import { updateQueueStatusAction, claimPatientAction } from "@/actions/queue"
import { Button } from "@/components/ui/button"
import { Loader2, Stethoscope, CheckCircle2, CreditCard, XCircle, UserCheck, FilePlus } from "lucide-react"
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

export function QueueEntryCard({ entry, role, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()

  const isDoctor = role === "DOCTOR"
  const isReception = role === "RECEPTIONIST" || role === "ADMIN"
  const isMyPatient = entry.doctorId === currentUserId

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

  const isActive = !["COMPLETED", "CANCELLED"].includes(entry.status)

  return (
    <div
      className="bg-white rounded-lg border p-4 flex items-start gap-4"
      style={{
        borderColor: isActive ? BRAND_COLORS.lightBackground : "#E5E7EB",
        opacity: isActive ? 1 : 0.65,
      }}
    >
      {/* Token */}
      <div
        className="flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
      >
        {entry.tokenNumber}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <Link
              href={`/patients/${entry.patient.id}`}
              className="font-semibold text-sm hover:underline"
              style={{ color: BRAND_COLORS.bodyText }}
            >
              {entry.patient.fullName}
            </Link>
            <span
              className="ml-2 text-xs font-mono"
              style={{ color: BRAND_COLORS.primaryTeal }}
            >
              {entry.patient.patientId}
            </span>
          </div>
          <QueueStatusBadge status={entry.status} />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            {VISIT_TYPE_LABELS[entry.visit.visitType] ?? entry.visit.visitType}
          </span>
          {entry.doctor && (
            <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              → {entry.doctor.name}
            </span>
          )}
          <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            {getTimeSince(entry.sentAt)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            📱 {entry.patient.mobile}
          </span>
        </div>

        {entry.visit.chiefComplaint && (
          <p className="text-xs mt-1 truncate" style={{ color: BRAND_COLORS.borderDivider }}>
            "{entry.visit.chiefComplaint}"
          </p>
        )}
      </div>

      {/* Action buttons */}
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 mt-1" style={{ color: BRAND_COLORS.borderDivider }} />
      ) : (
        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* WAITING → Doctor: Start / Claim */}
          {entry.status === "WAITING" && isDoctor && !entry.doctorId && (
            <Button
              size="sm"
              onClick={handleClaim}
              className="text-xs text-white h-7"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              Claim
            </Button>
          )}
          {entry.status === "WAITING" && isDoctor && isMyPatient && (
            <Button
              size="sm"
              onClick={() => handleStatusUpdate("WITH_DOCTOR")}
              className="text-xs text-white h-7"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              <Stethoscope className="h-3.5 w-3.5 mr-1" />
              Start
            </Button>
          )}

          {/* WITH_DOCTOR → Doctor: Create Estimate + Done */}
          {entry.status === "WITH_DOCTOR" && isDoctor && isMyPatient && (
            <>
              <Link
                href={`/doctor/estimate/new?visitId=${entry.visitId}&patientId=${entry.patient.id}`}
                className="flex items-center justify-center gap-1 text-xs text-white h-7 px-2 rounded-md font-medium"
                style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
              >
                <FilePlus className="h-3.5 w-3.5" />
                Estimate
              </Link>
              <Button
                size="sm"
                onClick={() => handleStatusUpdate("ESTIMATE_CREATED")}
                className="text-xs text-white h-7"
                style={{ backgroundColor: "#6D28D9" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Done
              </Button>
            </>
          )}

          {/* ESTIMATE_CREATED → Reception: Collect Payment */}
          {entry.status === "ESTIMATE_CREATED" && isReception && (
            <Link
              href={`/reception/collect-payment?patientId=${entry.patient.id}&visitId=${entry.visitId}`}
              className="flex items-center justify-center gap-1 text-xs text-white h-7 px-2 rounded-md font-medium"
              style={{ backgroundColor: "#C2410C" }}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Collect
            </Link>
          )}

          {/* PAYMENT_PENDING → Reception: Complete */}
          {entry.status === "PAYMENT_PENDING" && isReception && (
            <Button
              size="sm"
              onClick={() => handleStatusUpdate("COMPLETED")}
              className="text-xs text-white h-7"
              style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Complete
            </Button>
          )}

          {/* Cancel — reception only, active statuses */}
          {isReception && isActive && !["COMPLETED", "CANCELLED"].includes(entry.status) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusUpdate("CANCELLED")}
              className="text-xs h-7 border-[#CCCCCC]"
              style={{ color: "#EF4444" }}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
