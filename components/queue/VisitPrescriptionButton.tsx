"use client"

import { useState } from "react"
import Link from "next/link"
import { BRAND_COLORS } from "@/lib/constants"
import { ClipboardList, Zap } from "lucide-react"
import { QuickRxModal } from "@/components/prescriptions/QuickRxModal"
import { useRouter } from "next/navigation"

interface Props {
  visitId: string
}

export function VisitPrescriptionButton({ visitId }: Props) {
  const [showQuickRx, setShowQuickRx] = useState(false)
  const router = useRouter()

  const handleQuickRxSuccess = (prescriptionId: string) => {
    router.push(`/doctor/prescription/${prescriptionId}`)
  }

  return (
    <>
      <div className="flex gap-2">
        {/* Quick Rx — fast entry */}
        <button
          onClick={() => setShowQuickRx(true)}
          className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-blue-50"
          style={{ borderColor: BRAND_COLORS.primaryTeal, color: BRAND_COLORS.primaryTeal }}
          title="Fast prescription entry (2-3 min)"
        >
          <Zap className="h-4 w-4" />
          Quick Rx
        </button>

        {/* Full form — comprehensive entry */}
        <Link
          href={`/doctor/prescription/new?visitId=${visitId}`}
          prefetch={false}
          className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
          style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
          title="Full prescription form"
        >
          <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
          Prescription
        </Link>
      </div>

      {showQuickRx && (
        <QuickRxModal
          visitId={visitId}
          onSuccess={handleQuickRxSuccess}
          onClose={() => setShowQuickRx(false)}
        />
      )}
    </>
  )
}
