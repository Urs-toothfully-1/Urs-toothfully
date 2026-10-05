"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Gift, Loader2, Plus, Trash2 } from "lucide-react"
import { createInvoiceAction } from "@/actions/invoices"
import { computeInvoiceTotals } from "@/lib/invoice-totals"
import { formatRange } from "@/lib/payment-options"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { toothLabel } from "@/lib/teeth"

export interface BillableEstimate {
  id: string
  estimateNo: string
  items: {
    id: string
    treatmentName: string
    toothNumber: string | null
    quantity: number
    unitRate: number
    unitRateMax: number | null
  }[]
}

/** An unused referral-points discount (from rewardService.availableDiscounts). */
export interface AvailableReward {
  id: string
  label: string // e.g. "₹500 off — 2 referral points (Diwali Smiles)"
  kind: "DISCOUNT_FLAT" | "DISCOUNT_PERCENT"
  value: number
}

interface PlannedLine {
  estimateItemId: string
  checked: boolean
  treatmentName: string
  toothNumber: string | null
  quantity: number
  unitRate: number
  quoteMin: number
  quoteMax: number
}
interface ExtraLine {
  key: number
  treatmentName: string
  toothNumber: string
  quantity: number
  unitRate: number
}

const inputCls =
  "h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

function linesFor(est: BillableEstimate | undefined): PlannedLine[] {
  return (est?.items ?? []).map((i) => ({
    estimateItemId: i.id,
    checked: false,
    treatmentName: i.treatmentName,
    toothNumber: i.toothNumber,
    quantity: i.quantity,
    unitRate: i.unitRate,
    quoteMin: i.unitRate,
    quoteMax: i.unitRateMax ?? i.unitRate,
  }))
}

export function CreateInvoiceButton({
  patientId,
  visitId,
  estimates,
  rewards = [],
  size = "default",
}: {
  patientId: string
  visitId?: string
  estimates: BillableEstimate[]
  rewards?: AvailableReward[]
  size?: "default" | "sm"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [estimateId, setEstimateId] = useState(estimates[0]?.id ?? "")
  const [planned, setPlanned] = useState<PlannedLine[]>(() => linesFor(estimates[0]))
  const [extra, setExtra] = useState<ExtraLine[]>([])
  const [discountValue, setDiscountValue] = useState(0)
  const [discountIsPercent, setDiscountIsPercent] = useState(false)
  const [rewardId, setRewardId] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(() => new Intl.DateTimeFormat("en-CA").format(new Date()))
  const [notes, setNotes] = useState("")
  const [saving, startSaving] = useTransition()

  const selectedLines = useMemo(
    () => [
      ...planned.filter((l) => l.checked).map((l) => ({ quantity: l.quantity, unitRate: l.unitRate })),
      ...extra.filter((l) => l.treatmentName.trim()).map((l) => ({ quantity: l.quantity, unitRate: l.unitRate })),
    ],
    [planned, extra]
  )
  const totals = computeInvoiceTotals(selectedLines, discountValue, discountIsPercent)

  if (estimates.length === 0) return null

  function pickEstimate(id: string) {
    setEstimateId(id)
    setPlanned(linesFor(estimates.find((e) => e.id === id)))
  }
  function updatePlanned(id: string, patch: Partial<PlannedLine>) {
    setPlanned((p) => p.map((l) => (l.estimateItemId === id ? { ...l, ...patch } : l)))
  }
  function updateExtra(key: number, patch: Partial<ExtraLine>) {
    setExtra((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function pickReward(id: string) {
    setRewardId(id)
    const r = rewards.find((x) => x.id === id)
    // The reward fills the discount box; the reward is marked used with this invoice.
    if (r) {
      setDiscountIsPercent(r.kind === "DISCOUNT_PERCENT")
      setDiscountValue(r.value)
    }
  }

  function submit() {
    const items = [
      ...planned
        .filter((l) => l.checked)
        .map((l) => ({
          estimateItemId: l.estimateItemId,
          treatmentName: l.treatmentName,
          toothNumber: l.toothNumber ?? undefined,
          quantity: l.quantity,
          unitRate: l.unitRate,
        })),
      ...extra
        .filter((l) => l.treatmentName.trim())
        .map((l) => ({
          treatmentName: l.treatmentName.trim(),
          toothNumber: l.toothNumber.trim() || undefined,
          quantity: l.quantity,
          unitRate: l.unitRate,
        })),
    ]
    if (items.length === 0) {
      toast.error("Tick at least one treatment (or add one) to bill.")
      return
    }
    startSaving(async () => {
      const res = await createInvoiceAction({
        estimateId,
        visitId,
        invoiceDate,
        items,
        discountValue,
        discountIsPercent,
        notes: notes.trim() || undefined,
        redeemRewardId: rewardId || undefined,
      })
      if (!res.success || !res.invoiceId) {
        toast.error(res.error ?? "Failed to create invoice")
        return
      }
      toast.success(`Invoice ${res.invoiceNo} created`)
      setOpen(false)
      setPlanned(linesFor(estimates.find((e) => e.id === estimateId)))
      setExtra([])
      setDiscountValue(0)
      setRewardId("")
      setNotes("")
      window.open(`/print/invoice/${res.invoiceId}`, "_blank")
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={() => setOpen(true)}
        className="gap-1.5 text-white"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
        data-testid="open-invoice-dialog"
      >
        <FileText className="h-4 w-4" /> Bill treatment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bill today&apos;s treatment</DialogTitle>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Tick what was done and enter the actual price — the quoted range is only a guide. This invoice is what the patient owes.
            </p>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {estimates.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Treatment plan</Label>
                <select value={estimateId} onChange={(e) => pickEstimate(e.target.value)} className="w-full h-9 border rounded px-2 text-sm">
                  {estimates.map((e) => (
                    <option key={e.id} value={e.id}>{e.estimateNo}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Planned treatments */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#E0E3E5" }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                  <tr>
                    <th className="w-8" />
                    <th className="text-left px-2 py-2 font-medium">Treatment</th>
                    <th className="text-left px-2 py-2 font-medium">Quoted</th>
                    <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                    <th className="text-right px-2 py-2 font-medium w-32">Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {planned.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-3 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>No planned treatments — add one below.</td></tr>
                  )}
                  {planned.map((l) => (
                    <tr key={l.estimateItemId} className="border-t" style={{ borderColor: "#F0F2F4", opacity: l.checked ? 1 : 0.65 }}>
                      <td className="px-2 text-center">
                        <input
                          type="checkbox"
                          checked={l.checked}
                          onChange={(e) => updatePlanned(l.estimateItemId, { checked: e.target.checked })}
                          className="h-4 w-4"
                          aria-label={`Bill ${l.treatmentName}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>{l.treatmentName}</span>
                        {l.toothNumber && <span className="text-xs ml-1" style={{ color: BRAND_COLORS.borderDivider }}>· {toothLabel(l.toothNumber)}</span>}
                      </td>
                      <td className="px-2 py-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{formatRange(l.quoteMin, l.quoteMax)}</td>
                      <td className="px-2 py-1">
                        <Input type="number" min={1} value={l.quantity} disabled={!l.checked}
                          onChange={(e) => updatePlanned(l.estimateItemId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className={`${inputCls} text-right`} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" min={0} value={l.unitRate} disabled={!l.checked}
                          onChange={(e) => updatePlanned(l.estimateItemId, { unitRate: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className={`${inputCls} text-right`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unplanned treatments */}
            <div className="space-y-2">
              {extra.map((l) => (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
                  <Input placeholder="Other treatment (e.g. Scaling)" value={l.treatmentName}
                    onChange={(e) => updateExtra(l.key, { treatmentName: e.target.value })} className="col-span-5 h-8 text-sm" />
                  <Input placeholder="Tooth" value={l.toothNumber}
                    onChange={(e) => updateExtra(l.key, { toothNumber: e.target.value })} className="col-span-2 h-8 text-sm" />
                  <Input type="number" min={1} value={l.quantity}
                    onChange={(e) => updateExtra(l.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className={`col-span-1 ${inputCls} text-right`} />
                  <Input type="number" min={0} value={l.unitRate || ""} placeholder="Price"
                    onChange={(e) => updateExtra(l.key, { unitRate: Math.max(0, parseFloat(e.target.value) || 0) })} className={`col-span-3 ${inputCls} text-right`} />
                  <button type="button" onClick={() => setExtra((p) => p.filter((x) => x.key !== l.key))}
                    className="col-span-1 text-red-500 hover:text-red-700 flex justify-center" aria-label="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5"
                onClick={() => setExtra((p) => [...p, { key: Date.now(), treatmentName: "", toothNumber: "", quantity: 1, unitRate: 0 }])}>
                <Plus className="h-3.5 w-3.5" /> Add other treatment
              </Button>
            </div>

            {/* Referral reward */}
            {rewards.length > 0 && (
              <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: "#A7E3C0", backgroundColor: "#EAF7EF" }}>
                <Label className="text-xs flex items-center gap-1" style={{ color: "#065F46" }}>
                  <Gift className="h-3.5 w-3.5" /> This patient has an unused referral reward
                </Label>
                <select value={rewardId} onChange={(e) => pickReward(e.target.value)} className="w-full h-9 border rounded px-2 text-sm bg-white">
                  <option value="">Don&apos;t use it on this bill</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Discount</Label>
                <div className="flex gap-1">
                  <Input type="number" min={0} value={discountValue || ""} placeholder="0"
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))} className={`${inputCls} h-9`} />
                  <button type="button" onClick={() => setDiscountIsPercent((v) => !v)}
                    className="h-9 px-3 rounded border text-sm font-semibold" style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.primaryTeal }}
                    title="Switch between % and ₹">
                    {discountIsPercent ? "%" : "₹"}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice date</Label>
                <Input type="date" value={invoiceDate} max={new Intl.DateTimeFormat("en-CA").format(new Date())}
                  onChange={(e) => setInvoiceDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="h-9 text-sm" />
              </div>
            </div>

            <div className="ml-auto w-64 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between" style={{ color: BRAND_COLORS.secondaryGreen }}>
                  <span>Discount</span><span>− {formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base" style={{ color: BRAND_COLORS.primaryTeal }}>
                <span>Invoice total</span><span data-testid="invoice-total">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={saving} className="gap-1.5 text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Create invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
