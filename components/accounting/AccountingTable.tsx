"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle2, Download, Loader2 } from "lucide-react"
import { approveEntriesAction } from "@/actions/accounting"
import { AccountingEntryRow } from "@/components/accounting/AccountingEntryRow"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"

type Row = Parameters<typeof AccountingEntryRow>[0]["entry"] & { id: string; status: string }

/**
 * Accounting Ledger table with tick boxes: select all / some rows, then export
 * just those to Excel or approve them in one go. With nothing ticked, Export
 * takes every row matching the filters (all pages).
 */
export function AccountingTable({ entries, exportQuery }: { entries: Row[]; exportQuery: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  const allTicked = entries.length > 0 && entries.every((e) => selected.has(e.id))
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () => setSelected(allTicked ? new Set() : new Set(entries.map((e) => e.id)))

  const ticked = entries.filter((e) => selected.has(e.id))
  const tickedTotal = ticked.reduce((s, e) => s + Number(e.amount), 0)
  const tickedPending = ticked.filter((e) => e.status === "PENDING_REVIEW").map((e) => e.id)
  const exportHref = `/api/accounting/export?${exportQuery}${ticked.length ? `&ids=${ticked.map((e) => e.id).join(",")}` : ""}`

  function approve() {
    start(async () => {
      const r = await approveEntriesAction(tickedPending)
      if (r.success) {
        toast.success(`${r.count} entr${r.count === 1 ? "y" : "ies"} approved`)
        setSelected(new Set())
      } else toast.error(r.error ?? "Failed to approve")
    })
  }

  const btn = "flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold"

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          {ticked.length
            ? `${ticked.length} selected · ${formatCurrency(tickedTotal)}`
            : "Tick payments to export or approve only those"}
        </span>
        <div className="ml-auto flex gap-2">
          {tickedPending.length > 0 && (
            <button onClick={approve} disabled={pending} className={`${btn} text-white bg-green-600 hover:bg-green-700`}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve {tickedPending.length}
            </button>
          )}
          <a href={exportHref} className={`${btn} border border-[#E0E3E5] bg-white`} style={{ color: BRAND_COLORS.bodyText }}>
            <Download className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.primaryTeal }} />
            {ticked.length ? `Export ${ticked.length} selected` : "Export all (filtered)"}
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND_COLORS.lightBackground, borderBottom: `1px solid ${BRAND_COLORS.borderDivider}20` }}>
              <th className="pl-3 py-2.5 w-8">
                <input type="checkbox" checked={allTicked} onChange={toggleAll} className="h-4 w-4 cursor-pointer" aria-label="Select all payments" />
              </th>
              {["Date", "Patient", "Type", "Mode", "Amount", "Status", "Receipt", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: BRAND_COLORS.borderDivider }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <AccountingEntryRow key={entry.id} entry={entry} selected={selected.has(entry.id)} onToggle={() => toggle(entry.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
