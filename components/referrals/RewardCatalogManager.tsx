"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Gift, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { deleteRewardItemAction, saveRewardItemAction } from "@/actions/rewards"
import { REWARD_KINDS, isDiscountKind, rewardText, type RewardKind } from "@/lib/rewards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface CatalogRow {
  id: string
  name: string
  points: number
  kind: RewardKind
  value: number | null
  description: string | null
  isActive: boolean
  given: number
}

type Draft = { name: string; points: string; kind: RewardKind; value: string; description: string; isActive: boolean }
const EMPTY: Draft = { name: "", points: "500", kind: "FREE_CHECKUP", value: "", description: "", isActive: true }

/** Admin → Rewards & Referrals: what patients can buy with referral points. */
export function RewardCatalogManager({ items }: { items: CatalogRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editId, setEditId] = useState<string | null | "new">(null)
  const [d, setD] = useState<Draft>(EMPTY)

  function edit(row?: CatalogRow) {
    setEditId(row ? row.id : "new")
    setD(row
      ? { name: row.name, points: String(row.points), kind: row.kind, value: row.value != null ? String(row.value) : "", description: row.description ?? "", isActive: row.isActive }
      : EMPTY)
  }

  function save() {
    start(async () => {
      const res = await saveRewardItemAction(editId === "new" ? null : editId, {
        ...d, points: Number(d.points), value: isDiscountKind(d.kind) ? Number(d.value) || 0 : null,
      })
      if (res.error) return void toast.error(res.error)
      toast.success("Reward saved")
      setEditId(null)
      router.refresh()
    })
  }

  function run(fn: () => Promise<{ error?: string }>, ok: string) {
    start(async () => {
      const res = await fn()
      if (res.error) return void toast.error(res.error)
      toast.success(ok)
      router.refresh()
    })
  }

  const field = "h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Gift className="h-4 w-4 text-[#006B5F]" /> Rewards catalogue</h2>
          <p className="text-xs text-gray-500">Each referral earns 500 points for both patients. Doctors spend points on these rewards.</p>
        </div>
        {editId === null && (
          <Button size="sm" onClick={() => edit()} className="gap-1.5 bg-[#005E97] text-white hover:bg-[#00507f]">
            <Plus className="h-4 w-4" /> Add reward
          </Button>
        )}
      </div>

      {editId !== null && (
        <div className="mt-4 grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-6">
          <label className="sm:col-span-2 space-y-1">
            <span className="text-xs font-medium text-gray-700">Reward name</span>
            <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={120} placeholder="Free scaling & polishing" className="h-9" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-700">Price (points)</span>
            <Input type="number" min={1} step={100} value={d.points} onChange={(e) => setD({ ...d, points: e.target.value })} className="h-9" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-700">Type</span>
            <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as RewardKind })} className={`${field} w-full`}>
              {REWARD_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          {isDiscountKind(d.kind) ? (
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-700">{d.kind === "DISCOUNT_PERCENT" ? "Discount %" : "Discount ₹"}</span>
              <Input type="number" min={0} value={d.value} onChange={(e) => setD({ ...d, value: e.target.value })} className="h-9" />
            </label>
          ) : (
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-700">Details (optional)</span>
              <Input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={300} className="h-9" />
            </label>
          )}
          <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} className="h-4 w-4" /> Available
          </label>
          <div className="sm:col-span-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} disabled={pending}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={pending || d.name.trim().length < 2 || !(Number(d.points) >= 1)} className="bg-[#005E97] text-white hover:bg-[#00507f]">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save reward"}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-6 mb-2 text-center text-sm text-gray-500">No rewards yet — add one so doctors can spend patients&apos; points.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {items.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-3 py-2 ${r.isActive ? "" : "opacity-55"}`}>
              <span className="w-24 shrink-0 text-sm font-bold tabular-nums text-[#005E97]">{r.points.toLocaleString("en-IN")} pts</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{r.name}{!r.isActive && <span className="ml-2 text-[11px] text-gray-500">(paused)</span>}</p>
                <p className="text-xs text-gray-500">{rewardText(r.kind, r.value, r.description)} · given {r.given}×</p>
              </div>
              <button onClick={() => edit(r)} className="rounded p-1.5 hover:bg-gray-100" aria-label={`Edit ${r.name}`}><Pencil className="h-4 w-4 text-gray-500" /></button>
              <button
                onClick={() => run(() => (r.given ? saveRewardItemAction(r.id, { ...r, isActive: !r.isActive, description: r.description ?? "" }) : deleteRewardItemAction(r.id)), r.given ? (r.isActive ? "Paused" : "Resumed") : "Deleted")}
                disabled={pending}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                aria-label={r.given ? `Pause ${r.name}` : `Delete ${r.name}`}
              >
                {r.given ? (r.isActive ? "Pause" : "Resume") : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
