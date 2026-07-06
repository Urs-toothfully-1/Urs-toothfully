"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { createEstimateAction, EstimateFormState } from "@/actions/estimates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Plus, Trash2, Save } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { ToothSelector } from "@/components/dental/ToothSelector"

interface Treatment {
  id: string
  category: string
  name: string
  defaultAmount: number
}

interface EstimateItem {
  _key: string
  treatmentId: string
  treatmentName: string
  category: string
  toothNumber: string
  quantity: number
  unitRate: number
  amount: number
}

interface Props {
  patientId: string
  visitId: string
  branchId: string
  patientName: string
  visitNo: string
  doctorName: string
  treatments: Treatment[]
  advancePercent: number
  allowDiscount: boolean
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 px-6 font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
      ) : (
        <>Next — Prescription →</>
      )}
    </Button>
  )
}

function newItem(): EstimateItem {
  return {
    _key: Math.random().toString(36).slice(2),
    treatmentId: "",
    treatmentName: "",
    category: "",
    toothNumber: "",
    quantity: 1,
    unitRate: 0,
    amount: 0,
  }
}

const inputCls = "h-8 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white px-2"

export function EstimateBuilder({
  patientId, visitId, branchId, patientName, visitNo, doctorName,
  treatments, advancePercent, allowDiscount,
}: Props) {
  const [state, formAction] = useActionState(createEstimateAction, {} as EstimateFormState)
  const [items, setItems] = useState<EstimateItem[]>([newItem()])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)

  // Grouped treatments by category
  const byCategory = treatments.reduce<Record<string, Treatment[]>>((acc, t) => {
    ;(acc[t.category] ??= []).push(t)
    return acc
  }, {})

  // Computed totals
  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const discountAmount = allowDiscount ? (subtotal * discountPercent) / 100 : 0
  const total = subtotal - discountAmount
  const advanceRequired = (total * advancePercent) / 100

  function handleSelectTreatment(key: string, treatmentId: string) {
    const t = treatments.find((x) => x.id === treatmentId)
    setItems((prev) =>
      prev.map((item) =>
        item._key === key
          ? {
              ...item,
              treatmentId: t?.id ?? "",
              treatmentName: t?.name ?? "",
              category: t?.category ?? "",
              unitRate: t?.defaultAmount ?? 0,
              amount: (t?.defaultAmount ?? 0) * item.quantity,
            }
          : item
      )
    )
  }

  function handleChange(key: string, field: keyof EstimateItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item._key !== key) return item
        const updated = { ...item, [field]: value }
        updated.amount = updated.quantity * updated.unitRate
        if (field === "treatmentId") updated.treatmentId = value as string
        return updated
      })
    )
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()])
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i._key !== key) : prev))
  }

  function handleSubmit() {
    // Inject serialized items into the hidden input before the form submits
    const hidden = formRef.current?.querySelector<HTMLInputElement>('input[name="itemsJson"]')
    if (hidden) hidden.value = JSON.stringify(items)
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="itemsJson" defaultValue="" />

      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Context banner */}
      <div
        className="rounded-lg p-3 flex flex-wrap gap-4 text-sm"
        style={{ backgroundColor: BRAND_COLORS.lightBackground }}
      >
        <span style={{ color: BRAND_COLORS.bodyText }}>
          <span style={{ color: BRAND_COLORS.borderDivider }}>Patient: </span>
          <strong>{patientName}</strong>
        </span>
        <span style={{ color: BRAND_COLORS.bodyText }}>
          <span style={{ color: BRAND_COLORS.borderDivider }}>Visit: </span>
          <strong>{visitNo}</strong>
        </span>
        <span style={{ color: BRAND_COLORS.bodyText }}>
          <span style={{ color: BRAND_COLORS.borderDivider }}>Doctor: </span>
          <strong>{doctorName}</strong>
        </span>
      </div>

      {/* Treatment Items Table */}
      <div className="overflow-x-auto rounded-lg border border-[#E0E3E5]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
              <th className="text-left px-3 py-2.5 font-semibold text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                #
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                Treatment
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                Tooth #
              </th>
              <th className="text-center px-3 py-2.5 font-semibold text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                Qty
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                Rate (₹)
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                Amount
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item._key}
                className="border-t"
                style={{ borderColor: BRAND_COLORS.lightBackground }}
              >
                {/* Row number */}
                <td
                  className="px-3 py-2 text-xs font-medium"
                  style={{ color: BRAND_COLORS.borderDivider }}
                >
                  {idx + 1}
                </td>

                {/* Treatment selector + name */}
                <td className="px-2 py-2 min-w-[260px]">
                  <select
                    className="w-full h-8 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] mb-1"
                    value={item.treatmentId}
                    onChange={(e) => handleSelectTreatment(item._key, e.target.value)}
                  >
                    <option value="">— Select treatment —</option>
                    {Object.entries(byCategory).map(([cat, treats]) => (
                      <optgroup key={cat} label={cat}>
                        {treats.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (₹{t.defaultAmount.toLocaleString("en-IN")})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="custom">Custom Treatment</option>
                  </select>
                  {/* Editable name — shown always, pre-filled from master */}
                  <Input
                    value={item.treatmentName}
                    onChange={(e) => handleChange(item._key, "treatmentName", e.target.value)}
                    placeholder="Treatment name (required)"
                    className={inputCls}
                    required
                  />
                </td>

                {/* Tooth # — quadrant picker, single or multiple teeth */}
                <td className="px-2 py-2 w-32">
                  <ToothSelector
                    value={item.toothNumber}
                    onChange={(v) => handleChange(item._key, "toothNumber", v)}
                    compact
                  />
                </td>

                {/* Qty */}
                <td className="px-2 py-2 w-20">
                  <Input
                    type="number"
                    min={1}
                    value={qtyDraft[item._key] ?? item.quantity}
                    onChange={(e) => setQtyDraft((d) => ({ ...d, [item._key]: e.target.value }))}
                    onBlur={(e) => {
                      const n = Math.max(1, parseInt(e.target.value) || 1)
                      setQtyDraft((d) => { const { [item._key]: _, ...rest } = d; return rest })
                      handleChange(item._key, "quantity", n)
                    }}
                    className={`${inputCls} text-center`}
                  />
                </td>

                {/* Rate */}
                <td className="px-2 py-2 w-32">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitRate}
                    onChange={(e) => handleChange(item._key, "unitRate", parseFloat(e.target.value) || 0)}
                    className={`${inputCls} text-right`}
                  />
                </td>

                {/* Amount */}
                <td
                  className="px-3 py-2 text-right font-semibold w-28"
                  style={{ color: BRAND_COLORS.bodyText }}
                >
                  {formatCurrency(item.amount)}
                </td>

                {/* Delete */}
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeItem(item._key)}
                    disabled={items.length === 1}
                    className="p-1 rounded hover:bg-red-50 disabled:opacity-30 transition-colors"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Row button */}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: BRAND_COLORS.primaryTeal }}
      >
        <Plus className="h-4 w-4" />
        Add Treatment Row
      </button>

      {/* Bottom section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Notes
          </label>
          <Textarea
            name="notes"
            placeholder="Optional notes for this estimate"
            className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6] resize-none"
            rows={4}
          />
        </div>

        {/* Totals */}
        <div
          className="rounded-lg border p-4 space-y-2"
          style={{ borderColor: BRAND_COLORS.lightBackground }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Subtotal</span>
            <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(subtotal)}</span>
          </div>

          {allowDiscount && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span style={{ color: BRAND_COLORS.borderDivider }}>Discount</span>
                <div className="flex items-center gap-1">
                  <Input
                    name="discountPercent"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="h-6 w-16 border-[#E0E3E5] text-xs text-center px-1 bg-[#F2F4F6]"
                  />
                  <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>%</span>
                </div>
              </div>
              <span className="text-red-500">-{formatCurrency(discountAmount)}</span>
            </div>
          )}

          <div
            className="flex justify-between text-base font-bold pt-2 border-t"
            style={{ borderColor: BRAND_COLORS.lightBackground }}
          >
            <span style={{ color: BRAND_COLORS.bodyText }}>Total</span>
            <span style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(total)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span style={{ color: BRAND_COLORS.borderDivider }}>
              Advance Required ({advancePercent}%)
            </span>
            <span className="font-semibold" style={{ color: BRAND_COLORS.secondaryGreen }}>
              {formatCurrency(advanceRequired)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-4 pt-2 border-t"
        style={{ borderColor: BRAND_COLORS.lightBackground }}
      >
        <SubmitButton />
        <a
          href="/doctor"
          className="text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.borderDivider }}
        >
          Cancel
        </a>
      </div>
    </form>
  )
}
