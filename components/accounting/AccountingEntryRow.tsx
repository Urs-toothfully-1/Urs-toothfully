"use client"

import { useTransition, useState } from "react"
import Link from "next/link"
import { approveEntryAction, deleteEntryAction } from "@/actions/accounting"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CheckCircle2, Trash2, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"

interface Entry {
  id: string
  entryDate: Date | string
  paymentType: string
  paymentMode: string
  amount: number | string
  status: string
  notes?: string | null
  patient: { id: string; patientId: string; fullName: string }
  branch: { name: string }
  payment?: {
    transactionRef?: string | null
    receipt?: { id: string; receiptNo: string } | null
  } | null
}

const TYPE_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  CONSULTATION: { label: "Consult", bg: "#DBEAFE", color: "#1D4ED8" },
  TREATMENT: { label: "Treatment", bg: "#D1FAE5", color: "#065F46" },
  ADVANCE: { label: "Advance", bg: "#EDE9FE", color: "#6D28D9" },
  ADJUSTMENT: { label: "Adjust", bg: "#FEF3C7", color: "#B45309" },
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING_REVIEW: { bg: "#FEF3C7", color: "#B45309" },
  APPROVED: { bg: "#D1FAE5", color: "#065F46" },
  EXPORTED: { bg: "#F3F4F6", color: "#6B7280" },
}

const MODE_ABBR: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank",
}

export function AccountingEntryRow({ entry }: { entry: Entry }) {
  const [isPending, startTransition] = useTransition()
  const [showDeletePrompt, setShowDeletePrompt] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")

  const typeStyle = TYPE_STYLE[entry.paymentType] ?? TYPE_STYLE.CONSULTATION
  const statusStyle = STATUS_STYLE[entry.status] ?? STATUS_STYLE.PENDING_REVIEW
  const canApprove = entry.status === "PENDING_REVIEW"
  const canDelete = entry.status !== "EXPORTED"

  function handleApprove() {
    startTransition(async () => {
      const result = await approveEntryAction(entry.id)
      if (result.success) toast.success("Entry approved")
      else toast.error(result.error ?? "Failed to approve")
    })
  }

  function handleDelete() {
    if (!deleteReason.trim()) {
      toast.error("Please enter a reason")
      return
    }
    startTransition(async () => {
      const result = await deleteEntryAction(entry.id, deleteReason)
      if (result.success) {
        toast.success("Entry deleted")
        setShowDeletePrompt(false)
      } else {
        toast.error(result.error ?? "Failed to delete")
      }
    })
  }

  return (
    <>
      <tr
        className="border-b hover:bg-gray-50 transition-colors"
        style={{ borderColor: BRAND_COLORS.lightBackground }}
      >
        <td className="px-3 py-3 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          {formatDate(entry.entryDate)}
        </td>
        <td className="px-3 py-3">
          <Link
            href={`/patients/${entry.patient.id}`}
            className="text-sm font-medium hover:underline"
            style={{ color: BRAND_COLORS.bodyText }}
          >
            {entry.patient.fullName}
          </Link>
          <p className="text-xs mt-0.5 font-mono" style={{ color: BRAND_COLORS.primaryTeal }}>
            {entry.patient.patientId}
          </p>
        </td>
        <td className="px-3 py-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}
          >
            {typeStyle.label}
          </span>
        </td>
        <td className="px-3 py-3 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
          {MODE_ABBR[entry.paymentMode] ?? entry.paymentMode}
          {entry.payment?.transactionRef && (
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
              {entry.payment.transactionRef.slice(0, 12)}
            </p>
          )}
        </td>
        <td className="px-3 py-3 text-right">
          <span className="text-sm font-bold" style={{ color: BRAND_COLORS.bodyText }}>
            {formatCurrency(Number(entry.amount))}
          </span>
        </td>
        <td className="px-3 py-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
          >
            {entry.status.replace("_", " ")}
          </span>
        </td>
        <td className="px-3 py-3">
          {entry.payment?.receipt ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono" style={{ color: BRAND_COLORS.primaryTeal }}>
                {entry.payment.receipt.receiptNo}
              </span>
              <Link
                href={`/print/receipt/${entry.payment.receipt.id}`}
                target="_blank"
                className="p-0.5 hover:bg-gray-100 rounded"
              >
                <Printer className="h-3 w-3" style={{ color: BRAND_COLORS.borderDivider }} />
              </Link>
            </div>
          ) : (
            <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>—</span>
          )}
        </td>
        <td className="px-3 py-3">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND_COLORS.borderDivider }} />
          ) : (
            <div className="flex items-center gap-1.5">
              {canApprove && (
                <button
                  onClick={handleApprove}
                  className="p-1 rounded hover:bg-green-50"
                  title="Approve"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeletePrompt(true)}
                  className="p-1 rounded hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {/* Delete confirmation row */}
      {showDeletePrompt && (
        <tr style={{ backgroundColor: "#FEF2F2" }}>
          <td colSpan={8} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Reason for deletion (required)"
                className="flex-1 h-8 border border-red-300 rounded px-2 text-sm bg-white"
                autoFocus
              />
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-3 py-1 rounded text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setShowDeletePrompt(false)}
                className="px-3 py-1 rounded text-xs border border-gray-300 bg-white"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
