"use client"

import Link from "next/link"
import { BRAND_COLORS } from "@/lib/constants"
import { ClipboardList } from "lucide-react"

interface Props {
  visitId: string
}

// Opens a blank prescription form. The record is created only when the doctor
// actually saves data (create-on-save) — an accidental open creates nothing.
export function VisitPrescriptionButton({ visitId }: Props) {
  return (
    <Link
      href={`/doctor/prescription/new?visitId=${visitId}`}
      prefetch={false}
      className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
      style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
    >
      <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
      Prescription (this visit)
    </Link>
  )
}
