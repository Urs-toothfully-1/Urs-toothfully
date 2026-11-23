"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { redeemPointsAction } from "@/actions/rewards"
import { BRAND_COLORS } from "@/lib/constants"
import { isDiscountKind, rewardText, type RewardKind } from "@/lib/rewards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Gift, Loader2 } from "lucide-react"

export interface CatalogueItem {
  id: string
  name: string
  points: number
  kind: RewardKind
  value: number | null
  description: string | null
}

const pts = (n: number) => n.toLocaleString("en-IN")

/** Spend a patient's referral points on a reward from the catalogue. */
export function RedeemPointsDialog({
  patientId,
  available,
  items,
}: {
  patientId: string
  available: number
  items: CatalogueItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [itemId, setItemId] = useState("")
  const [note, setNote] = useState("")
  const [markUsedNow, setMarkUsedNow] = useState(false)
  const item = items.find((i) => i.id === itemId)
  const cheapest = items.length ? Math.min(...items.map((i) => i.points)) : Infinity

  function choose(i: CatalogueItem) {
    setItemId(i.id)
    setMarkUsedNow(!isDiscountKind(i.kind))
  }

  function submit() {
    if (!item) return
    start(async () => {
      const res = await redeemPointsAction({
        patientId,
        rewardItemId: item.id,
        note: note.trim() || undefined,
        markUsedNow,
      })
      if (res.success) {
        toast.success(`${item.name} given — ${pts(item.points)} points used`)
        setOpen(false)
        setItemId("")
        setNote("")
        router.refresh()
      } else toast.error(res.error ?? "Failed to give the reward")
    })
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={available < cheapest}
        className="h-8 gap-1.5 text-white"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
        title={
          items.length ? undefined : "Add rewards to the catalogue in Admin → Rewards & Referrals"
        }
      >
        <Gift className="h-3.5 w-3.5" /> Use points
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Give a referral reward</DialogTitle>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              {pts(available)} points available · each referral earns 500 points for both patients.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {items.map((i) => {
                const afford = i.points <= available
                const active = i.id === itemId
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      disabled={!afford}
                      onClick={() => choose(i)}
                      className="w-full rounded-md border p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
                      style={{
                        borderColor: active ? BRAND_COLORS.primaryTeal : "#E0E3E5",
                        backgroundColor: active ? `${BRAND_COLORS.primaryTeal}0D` : "white",
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: BRAND_COLORS.bodyText }}
                        >
                          {i.name}
                        </span>
                        <span
                          className="shrink-0 text-xs font-bold"
                          style={{ color: BRAND_COLORS.primaryTeal }}
                        >
                          {pts(i.points)} pts
                        </span>
                      </span>
                      <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {rewardText(i.kind, i.value, i.description)}
                        {!afford ? ` · needs ${pts(i.points - available)} more` : ""}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Note (optional)"
              className="h-9"
            />

            <label
              className="flex cursor-pointer items-start gap-2 text-xs"
              style={{ color: BRAND_COLORS.bodyText }}
            >
              <input
                type="checkbox"
                checked={markUsedNow}
                onChange={(e) => setMarkUsedNow(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <span>
                Given today — mark as used now
                <span className="block" style={{ color: BRAND_COLORS.borderDivider }}>
                  {item && isDiscountKind(item.kind)
                    ? "Leave unticked to apply this discount from the Bill treatment dialog."
                    : "Untick if the patient will use it on a later visit."}
                </span>
              </span>
            </label>

            {item && (
              <div
                className="rounded-md p-2.5 text-sm"
                style={{ backgroundColor: "#EAF7EF", color: "#065F46" }}
              >
                {pts(item.points)} points → <strong>{item.name}</strong> ·{" "}
                {pts(available - item.points)} left
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !item}
              className="text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Give reward"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
