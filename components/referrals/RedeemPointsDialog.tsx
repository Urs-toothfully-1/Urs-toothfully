"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { redeemPointsAction } from "@/actions/rewards"
import { BRAND_COLORS } from "@/lib/constants"
import { REWARD_KINDS, isDiscountKind, rewardText, type RewardKind } from "@/lib/rewards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Gift, Loader2, Minus, Plus } from "lucide-react"

export interface RedeemCampaign {
  id: string
  name: string
  referrerOffer: string
  refereeOffer: string
  referrerKind: RewardKind
  referrerValue: number | null
  refereeKind: RewardKind
  refereeValue: number | null
}

/**
 * Doctor spends some of a patient's referral points on a reward she decides.
 * A campaign only pre-fills the suggestion; everything stays editable.
 */
export function RedeemPointsDialog({
  patientId,
  available,
  campaigns,
  defaultSide,
}: {
  patientId: string
  available: number
  campaigns: RedeemCampaign[]
  /** Which offer to pre-fill: this patient as the referrer, or as the new patient. */
  defaultSide: "REFERRER" | "REFEREE"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [campaignId, setCampaignId] = useState("")
  const [side, setSide] = useState(defaultSide)
  const [points, setPoints] = useState(1)
  const [kind, setKind] = useState<RewardKind>("DISCOUNT_FLAT")
  const [value, setValue] = useState("")
  const [description, setDescription] = useState("")
  const [note, setNote] = useState("")
  const [markUsedNow, setMarkUsedNow] = useState(false)

  function prefill(cid: string, s: "REFERRER" | "REFEREE") {
    const c = campaigns.find((x) => x.id === cid)
    if (!c) return
    const k = s === "REFERRER" ? c.referrerKind : c.refereeKind
    const v = s === "REFERRER" ? c.referrerValue : c.refereeValue
    setKind(k)
    setValue(v ? String(v) : "")
    setDescription(isDiscountKind(k) ? "" : s === "REFERRER" ? c.referrerOffer : c.refereeOffer)
    setMarkUsedNow(!isDiscountKind(k))
  }

  function submit() {
    start(async () => {
      const res = await redeemPointsAction({
        patientId,
        points,
        campaignId: campaignId || null,
        kind,
        value: isDiscountKind(kind) ? Number(value) || 0 : null,
        description: description.trim(),
        note: note.trim() || undefined,
        markUsedNow,
      })
      if (res.success) {
        toast.success(`Reward given — ${points} point${points === 1 ? "" : "s"} used`)
        setOpen(false)
        setPoints(1)
        router.refresh()
      } else toast.error(res.error ?? "Failed to give the reward")
    })
  }

  const selected = campaigns.find((c) => c.id === campaignId)
  const label = "text-xs font-medium"

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={available < 1} className="h-8 gap-1.5 text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
        <Gift className="h-3.5 w-3.5" /> Use points
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Give a referral reward</DialogTitle>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              {`${available} point${available === 1 ? "" : "s"} available · 1 referral = 1 point. Used points can’t be used again.`}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Points */}
            <div>
              <p className={label} style={{ color: BRAND_COLORS.bodyText }}>Points to use</p>
              <div className="mt-1 flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setPoints((p) => Math.max(1, p - 1))} aria-label="Fewer points">
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number" min={1} max={available} value={points}
                  onChange={(e) => setPoints(Math.min(available, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="h-9 w-20 text-center font-semibold" aria-label="Points to use"
                />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setPoints((p) => Math.min(available, p + 1))} aria-label="More points">
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-xs ml-1" style={{ color: BRAND_COLORS.borderDivider }}>of {available}</span>
              </div>
            </div>

            {/* Campaign → suggestion */}
            {campaigns.length > 0 && (
              <div className="space-y-1.5">
                <p className={label} style={{ color: BRAND_COLORS.bodyText }}>Campaign (fills a suggestion)</p>
                <select
                  value={campaignId}
                  onChange={(e) => { setCampaignId(e.target.value); prefill(e.target.value, side) }}
                  className="w-full h-9 rounded-md border px-2 text-sm bg-white" style={{ borderColor: "#E0E3E5" }}
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selected && (
                  <div className="grid grid-cols-2 gap-2">
                    {(["REFERRER", "REFEREE"] as const).map((s) => (
                      <button
                        key={s} type="button"
                        onClick={() => { setSide(s); prefill(campaignId, s) }}
                        className="rounded-md border p-2 text-left text-xs"
                        style={{ borderColor: side === s ? BRAND_COLORS.primaryTeal : "#E0E3E5", backgroundColor: side === s ? `${BRAND_COLORS.primaryTeal}0D` : "white" }}
                      >
                        <span className="block font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{s === "REFERRER" ? "Referrer offer" : "New-patient offer"}</span>
                        <span style={{ color: BRAND_COLORS.borderDivider }}>{s === "REFERRER" ? selected.referrerOffer : selected.refereeOffer}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reward — the doctor decides */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className={label} style={{ color: BRAND_COLORS.bodyText }}>Reward</p>
                <select
                  value={kind}
                  onChange={(e) => { const k = e.target.value as RewardKind; setKind(k); setMarkUsedNow(!isDiscountKind(k)) }}
                  className="w-full h-9 rounded-md border px-2 text-sm bg-white" style={{ borderColor: "#E0E3E5" }}
                >
                  {REWARD_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              {isDiscountKind(kind) ? (
                <div className="space-y-1">
                  <p className={label} style={{ color: BRAND_COLORS.bodyText }}>{kind === "DISCOUNT_PERCENT" ? "Discount %" : "Discount ₹"}</p>
                  <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="h-9" placeholder={kind === "DISCOUNT_PERCENT" ? "10" : "500"} />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className={label} style={{ color: BRAND_COLORS.bodyText }}>{kind === "FREE_TREATMENT" ? "Which treatment?" : "Details"}</p>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="h-9"
                    placeholder={kind === "FREE_TREATMENT" ? "Scaling & polishing" : kind === "FREE_CHECKUP" ? "Optional" : "Describe the reward"} />
                </div>
              )}
            </div>

            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (optional)" className="h-9" />

            <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: BRAND_COLORS.bodyText }}>
              <input type="checkbox" checked={markUsedNow} onChange={(e) => setMarkUsedNow(e.target.checked)} className="mt-0.5 h-3.5 w-3.5" />
              <span>
                Given today — mark as used now
                <span className="block" style={{ color: BRAND_COLORS.borderDivider }}>
                  {isDiscountKind(kind) ? "Leave unticked to apply this discount from the Bill treatment dialog." : "Untick if the patient will use it on a later visit."}
                </span>
              </span>
            </label>

            <div className="rounded-md p-2.5 text-sm" style={{ backgroundColor: "#EAF7EF", color: "#065F46" }}>
              {points} point{points === 1 ? "" : "s"} → <strong>{rewardText(kind, Number(value) || 0, description)}</strong>
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
