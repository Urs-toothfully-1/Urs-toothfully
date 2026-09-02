"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteLedgerEntryAction, getLedgerAttachmentAction } from "@/actions/ledger"
import { LEDGER_CATEGORIES } from "@/lib/ledger-categories"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Receipt, Trash2, Loader2 } from "lucide-react"

const LABEL = Object.fromEntries(LEDGER_CATEGORIES.map((c) => [c.value, c.label]))

export interface LedgerRow {
  id: string
  entryDate: Date | string
  category: string
  amount: number | string
  paymentMode: string
  payee: string | null
  notes: string | null
  hasAttachment: boolean
  branch: { name: string }
  createdBy: { name: string }
}

export function LedgerEntryRow({ entry, showBranch }: { entry: LedgerRow; showBranch: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [bill, setBill] = useState<string | null>(null)
  const [billOpen, setBillOpen] = useState(false)
  const [billBusy, setBillBusy] = useState(false)

  async function viewBill() {
    setBillBusy(true)
    const res = await getLedgerAttachmentAction(entry.id)
    setBillBusy(false)
    if (res.data) { setBill(res.data); setBillOpen(true) }
    else toast.error(res.error ?? "No bill")
  }

  function remove() {
    const reason = window.prompt("Reason for deleting this entry? (recorded in the audit log)")
    if (!reason || !reason.trim()) return
    startTransition(async () => {
      const res = await deleteLedgerEntryAction(entry.id, reason)
      if (res.success) { toast.success("Entry deleted"); router.refresh() }
      else toast.error(res.error ?? "Failed to delete")
    })
  }

  return (
    <tr className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
      <td className="py-2.5 px-2 text-xs whitespace-nowrap" style={{ color: BRAND_COLORS.bodyText }}>{formatDate(entry.entryDate)}</td>
      <td className="py-2.5 px-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}12`, color: BRAND_COLORS.primaryTeal }}>
          {LABEL[entry.category] ?? entry.category}
        </span>
      </td>
      <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
        {entry.payee || <span style={{ color: BRAND_COLORS.borderDivider }}>—</span>}
        {entry.notes && <span className="block text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>{entry.notes}</span>}
      </td>
      {showBranch && <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{entry.branch.name}</td>}
      <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{entry.paymentMode.replace("_", " ")}</td>
      <td className="py-2.5 px-2 text-sm font-semibold text-right whitespace-nowrap" style={{ color: "#C2410C" }}>
        {formatCurrency(Number(entry.amount))}
      </td>
      <td className="py-2.5 px-2">
        <div className="flex items-center justify-end gap-1.5">
          {entry.hasAttachment && (
            <button onClick={viewBill} disabled={billBusy} title="View bill" className="p-1.5 rounded hover:bg-gray-100">
              {billBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />}
            </button>
          )}
          <button onClick={remove} disabled={pending} title="Delete" className="p-1.5 rounded hover:bg-red-50">
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
        </div>

        <Dialog open={billOpen} onOpenChange={setBillOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Bill / Invoice</DialogTitle></DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {bill && <img src={bill} alt="bill" className="w-full rounded border" />}
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  )
}
