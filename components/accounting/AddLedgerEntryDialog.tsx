"use client"

import { useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createLedgerEntryAction } from "@/actions/ledger"
import { istTodayStr } from "@/lib/ist"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { LEDGER_CATEGORIES } from "@/lib/ledger-categories"
import { Plus, Loader2, ImagePlus, X } from "lucide-react"

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"]
const selectCls = "h-9 w-full rounded border border-[#E0E3E5] bg-white px-2 text-sm"

/** Downscale a picked image to <=1200px JPEG and return a base64 data URL. */
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 1200
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no canvas"))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.7))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function AddLedgerEntryDialog({
  branches,
  defaultBranchId,
  defaultCategory,
}: {
  branches: { id: string; name: string }[]
  defaultBranchId?: string
  /** Pre-selects the category (e.g. the tab the admin is filtered on). */
  defaultCategory?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [attachment, setAttachment] = useState<string | null>(null)
  const [imgBusy, setImgBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    branchId: defaultBranchId ?? branches[0]?.id ?? "",
    entryDate: istTodayStr(),
    category: LEDGER_CATEGORIES.some((c) => c.value === defaultCategory) ? (defaultCategory as string) : "PURCHASE",
    amount: "",
    paymentMode: "CASH",
    payee: "",
    notes: "",
  })
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  async function onPickImage(file?: File) {
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return }
    setImgBusy(true)
    try {
      const dataUrl = await resizeToDataUrl(file)
      if (dataUrl.length > 2_000_000) { toast.error("That image is too large even after resizing."); return }
      setAttachment(dataUrl)
    } catch {
      toast.error("Could not read that image.")
    } finally {
      setImgBusy(false)
    }
  }

  function submit() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter an amount greater than 0."); return }
    startTransition(async () => {
      const res = await createLedgerEntryAction({
        ...form,
        direction: "OUT",
        attachmentData: attachment ?? undefined,
      })
      if (res.success) {
        toast.success("Entry saved")
        setOpen(false)
        setAttachment(null)
        setForm((p) => ({ ...p, amount: "", payee: "", notes: "" }))
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to save")
      }
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="h-9 gap-1.5 text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
        <Plus className="h-4 w-4" /> Add Expense
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record an Expense</DialogTitle></DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Branch</label>
                <select className={selectCls} value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Date</label>
                <Input type="date" value={form.entryDate} max={istTodayStr()} onChange={(e) => set("entryDate", e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Category</label>
                <select className={selectCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {LEDGER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Amount (₹)</label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className="h-9" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Paid via</label>
                <select className={selectCls} value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
                  {MODES.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Payee / Vendor</label>
                <Input value={form.payee} onChange={(e) => set("payee", e.target.value)} className="h-9" placeholder="Optional" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Notes</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Optional" />
            </div>

            <div>
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Bill / Invoice photo</label>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickImage(e.target.files?.[0])} />
              {attachment ? (
                <div className="mt-1 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachment} alt="bill" className="h-16 w-16 rounded border object-cover" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setAttachment(null)}><X className="h-3.5 w-3.5" /> Remove</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="mt-1 gap-1.5" disabled={imgBusy} onClick={() => fileRef.current?.click()}>
                  {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Attach photo
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending} className="text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
