"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BRAND_COLORS } from "@/lib/constants"

/**
 * Receipt date picker for payment forms. Defaults to today and cannot be set in
 * the future; a receptionist may back-date to a previous date. The server only
 * honours a strictly-past date (see lib/payment-date.ts) and books both the
 * payment and its accounting entry on that day, so the day-book stays correct.
 */
export function ReceiptDateField({ name = "paymentDate" }: { name?: string }) {
  const today = new Intl.DateTimeFormat("en-CA").format(new Date()) // YYYY-MM-DD, local
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
        Receipt Date
      </Label>
      <Input
        name={name}
        type="date"
        defaultValue={today}
        max={today}
        className="h-10 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6]"
      />
    </div>
  )
}
