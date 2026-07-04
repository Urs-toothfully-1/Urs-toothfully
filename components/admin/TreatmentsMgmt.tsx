"use client"

import { useActionState, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { createTreatmentAction, deleteTreatmentAction, TreatmentFormState } from "@/actions/treatments"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"

interface Treatment { id: string; name: string; defaultAmount: number | string; isActive: boolean }

interface Props {
  grouped: Record<string, Treatment[]>
  categories: string[]
}

function AddBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} size="sm" className="h-8 text-xs text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Add</>}
    </Button>
  )
}

function AddTreatmentForm({ category, onSuccess }: { category: string; onSuccess: () => void }) {
  const [state, action] = useActionState(createTreatmentAction, {} as TreatmentFormState)

  if (state.success) {
    onSuccess()
    return null
  }

  return (
    <form action={action} className="flex gap-2 items-end mt-3 p-3 rounded-lg border border-dashed"
      style={{ borderColor: BRAND_COLORS.primaryTeal }}>
      <input type="hidden" name="category" value={category} />
      <div className="flex-1 space-y-1">
        <label className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Treatment Name</label>
        <Input name="name" placeholder="e.g. Root Canal (Molar)" required
          className="h-8 text-sm border-[#E0E3E5] bg-[#F2F4F6]" />
      </div>
      <div className="w-28 space-y-1">
        <label className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Default Amount ₹</label>
        <Input name="defaultAmount" type="number" min={1} step={0.01} placeholder="0"
          className="h-8 text-sm border-[#E0E3E5] bg-[#F2F4F6]" required />
      </div>
      <AddBtn />
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
    </form>
  )
}

export function TreatmentsMgmt({ grouped, categories }: Props) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set([categories[0]]))
  const [addingIn, setAddingIn] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleCategory(cat: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleDelete(id: string, name: string) {
    const reason = window.prompt(`Delete "${name}"?\n\nEnter reason:`)
    if (!reason?.trim()) return
    startTransition(async () => {
      const result = await deleteTreatmentAction(id, reason)
      if (result.success) toast.success(`"${name}" deleted`)
      else toast.error(result.error ?? "Failed to delete")
    })
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const items = grouped[cat] ?? []
        const isOpen = openCategories.has(cat)

        return (
          <Card key={cat} className="border-[#E0E3E5] bg-white overflow-hidden">
            {/* Use div instead of button to avoid button-in-button hydration error */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleCategory(cat)}
              onKeyDown={(e) => e.key === "Enter" && toggleCategory(cat)}
              className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
                  : <ChevronRight className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />}
                <span className="font-semibold text-sm" style={{ color: BRAND_COLORS.bodyText }}>{cat}</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}>
                  {items.length} treatments
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAddingIn(cat); if (!isOpen) toggleCategory(cat) }}
                className="flex items-center gap-1 text-xs font-medium hover:opacity-80 px-2 py-1"
                style={{ color: BRAND_COLORS.primaryTeal }}
              >
                <Plus className="h-3.5 w-3.5" />Add
              </button>
            </div>

            {isOpen && (
              <div className="border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                {items.length === 0 && !addingIn && (
                  <p className="text-xs text-center py-4" style={{ color: BRAND_COLORS.borderDivider }}>
                    No treatments in this category
                  </p>
                )}
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 hover:bg-gray-50"
                    style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>{t.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                        {formatCurrency(Number(t.defaultAmount))}
                      </span>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        disabled={isPending}
                        className="p-1 rounded hover:bg-red-50"
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-400" />}
                      </button>
                    </div>
                  </div>
                ))}
                {addingIn === cat && (
                  <div className="px-4 pb-4">
                    <AddTreatmentForm category={cat} onSuccess={() => setAddingIn(null)} />
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
