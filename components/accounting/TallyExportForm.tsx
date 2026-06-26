"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BRAND_COLORS } from "@/lib/constants"
import { Download, Loader2, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

interface Branch {
  id: string
  name: string
}

interface Props {
  branches: Branch[]
  defaultBranchId?: string
}

const selectCls =
  "h-10 w-full rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8]"

export function TallyExportForm({ branches, defaultBranchId }: Props) {
  const today = new Date().toISOString().split("T")[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0]

  const [branchId, setBranchId] = useState(defaultBranchId ?? "")
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    setError("")
    if (!fromDate || !toDate) {
      setError("Please select both from and to dates.")
      return
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setError("From date must be before To date.")
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/tally/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: branchId || undefined, fromDate, toDate, format: "CSV" }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? "Export failed")
          return
        }

        const batchNo = res.headers.get("X-Batch-No") ?? "export"
        const count = res.headers.get("X-Record-Count") ?? "0"
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `tally-${batchNo}-${fromDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${count} entries — ${batchNo}`)
      } catch {
        setError("Export failed. Please try again.")
      }
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Branch */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Branch
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={selectCls}
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* From */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            From Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 w-full rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8]"
          />
        </div>

        {/* To */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            To Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            max={today}
            className="h-10 w-full rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleExport}
          disabled={isPending}
          className="h-10 px-6 font-semibold text-white"
          style={{ backgroundColor: isPending ? BRAND_COLORS.borderDivider : BRAND_COLORS.secondaryGreen }}
        >
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting…</>
          ) : (
            <><Download className="mr-2 h-4 w-4" />Export CSV</>
          )}
        </Button>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          <FileSpreadsheet className="h-4 w-4" />
          Exports APPROVED entries only · Marks them as EXPORTED
        </div>
      </div>
    </div>
  )
}
