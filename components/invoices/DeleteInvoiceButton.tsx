"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteInvoiceAction } from "@/actions/invoices"
import { Trash2 } from "lucide-react"

export function DeleteInvoiceButton({ invoiceId, invoiceNo, patientId }: { invoiceId: string; invoiceNo: string; patientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove() {
    const reason = window.prompt(`Delete ${invoiceNo}? Give a reason:`, "")
    if (!reason?.trim()) return
    startTransition(async () => {
      const res = await deleteInvoiceAction(invoiceId, reason, patientId)
      if (res.success) { toast.success(`${invoiceNo} deleted`); router.refresh() }
      else toast.error(res.error ?? "Failed to delete invoice")
    })
  }

  return (
    <button type="button" onClick={remove} disabled={pending} aria-label={`Delete ${invoiceNo}`} className="p-1 rounded hover:bg-red-50">
      <Trash2 className="h-4 w-4 text-red-600" />
    </button>
  )
}
