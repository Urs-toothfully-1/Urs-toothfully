"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { grantReferralRewardAction } from "@/actions/referrals"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Gift, Loader2 } from "lucide-react"

type RewardType = "DISCOUNT_CREDIT" | "FREE_CHECKUP" | "FREE_TREATMENT"

const TYPES: [RewardType, string, string][] = [
  ["DISCOUNT_CREDIT", "Discount ₹", "Taken off a future treatment invoice."],
  ["FREE_CHECKUP", "Free check-up", "Mark it used when the check-up is done."],
  ["FREE_TREATMENT", "Free treatment", "Bill it at ₹0 (or mark used) when it is done."],
]

export function GrantRewardDialog({
  referralId,
  referrerName,
  refereeName,
}: {
  referralId: string
  referrerName: string
  refereeName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<RewardType>("DISCOUNT_CREDIT")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

  function submit() {
    if (type === "DISCOUNT_CREDIT" && !(Number(amount) > 0)) { toast.error("Enter the discount amount."); return }
    if (type === "FREE_TREATMENT" && !note.trim()) { toast.error("Name the free treatment."); return }
    startTransition(async () => {
      const res = await grantReferralRewardAction({
        referralId,
        type,
        amount: type === "DISCOUNT_CREDIT" ? amount : 0,
        note: note || undefined,
      })
      if (res.success) {
        toast.success("Reward granted")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to grant reward")
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="h-8 gap-1.5 text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
        <Gift className="h-3.5 w-3.5" /> Give reward
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reward {referrerName}</DialogTitle></DialogHeader>
          <p className="text-xs -mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
            For referring <strong>{refereeName}</strong>.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Reward</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {TYPES.map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setType(v)}
                    className="h-9 rounded-md border text-xs font-medium"
                    style={{
                      backgroundColor: type === v ? BRAND_COLORS.primaryTeal : "white",
                      color: type === v ? "white" : BRAND_COLORS.bodyText,
                      borderColor: type === v ? BRAND_COLORS.primaryTeal : "#E0E3E5",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                {TYPES.find(([v]) => v === type)![2]}
              </p>
            </div>

            {type === "DISCOUNT_CREDIT" && (
              <div>
                <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>Discount amount (₹)</label>
                <Input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" placeholder="e.g. 500" />
              </div>
            )}

            <div>
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                {type === "FREE_TREATMENT" ? "Which treatment?" : "Note (optional)"}
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={type === "FREE_TREATMENT" ? "e.g. Scaling & polishing" : "Optional"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} disabled={pending} className="text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Give reward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
