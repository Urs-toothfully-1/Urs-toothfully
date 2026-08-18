"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import { createProductInvoiceAction } from "@/actions/product-invoices"
import { PRODUCT_CATEGORIES } from "@/lib/template-options"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

interface ProductItem {
  name: string
  category: (typeof PRODUCT_CATEGORIES)[number]
  quantity: number
  unitPrice: number
}

interface Props {
  patientId: string
  branchId: string
  onClose: () => void
}

const MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
] as const

const emptyItem = (): ProductItem => ({ name: "", category: "X-ray", quantity: 1, unitPrice: 0 })

export function ProductInvoiceDialog({ patientId, branchId, onClose }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ProductItem[]>([emptyItem()])
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("CASH")
  const [transactionRef, setTransactionRef] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const updateItem = (idx: number, patch: Partial<ProductItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const total = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)

  const handleSave = async () => {
    if (items.some((it) => !it.name.trim())) {
      toast.error("Every line needs a name")
      return
    }
    if (items.some((it) => it.quantity <= 0 || it.unitPrice <= 0)) {
      toast.error("Quantity and price must be greater than 0")
      return
    }

    setSaving(true)
    try {
      const result = await createProductInvoiceAction({
        patientId,
        branchId,
        items,
        mode,
        transactionRef: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      if (result.success && result.receiptId) {
        toast.success(`Receipt ${result.receiptNo} created`)
        router.refresh()
        onClose()
        window.open(`/print/receipt/${result.receiptId}`, "_blank")
      } else {
        toast.error(result.error || "Failed to create invoice")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bill Products &amp; Services</DialogTitle>
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            X-rays, lab tests and supplies — records the payment and issues a receipt.
          </p>
        </DialogHeader>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  placeholder="Item name (e.g. OPG X-ray)"
                  value={item.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  className="col-span-4 text-xs"
                />
                <select
                  value={item.category}
                  onChange={(e) => updateItem(idx, { category: e.target.value as ProductItem["category"] })}
                  className="col-span-3 text-xs border rounded px-2 h-9"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity || ""}
                  onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value, 10) || 0 })}
                  className="col-span-1 text-xs"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Price"
                  value={item.unitPrice || ""}
                  onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="col-span-2 text-xs"
                />
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <span className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={items.length === 1}
                    className="p-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="w-full text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Payment Mode</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                className="w-full text-xs border rounded px-2 h-9"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Transaction / UPI Reference</Label>
              <Input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Ref number (for UPI / Card)"
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to record against this bill…"
              className="w-full text-xs border rounded p-2 h-14 resize-none"
            />
          </div>

          <div className="flex justify-end pt-3 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <div className="text-sm font-bold" style={{ color: BRAND_COLORS.bodyText }}>
              Total: <span style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || total <= 0}>
            {saving ? "Creating…" : "Collect & Generate Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
