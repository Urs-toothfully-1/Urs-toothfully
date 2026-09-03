"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ensureReferralCodeAction } from "@/actions/referrals"
import { APP_NAME, BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Gift, Loader2, Copy, MessageCircle } from "lucide-react"

export function ReferAndEarnButton({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState<string | null>(null)

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/intake?ref=${code}` : ""
  const message = `Get your dental care at ${APP_NAME}! Register with my referral link and we both get a reward: ${link}`

  function openShare() {
    setOpen(true)
    if (code) return
    startTransition(async () => {
      const res = await ensureReferralCodeAction(patientId)
      if (res.code) setCode(res.code)
      else toast.error(res.error ?? "Could not create a referral code")
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openShare} className="gap-1.5" style={{ color: BRAND_COLORS.primaryTeal, borderColor: "#E0E3E5" }}>
        <Gift className="h-4 w-4" /> Refer &amp; Earn
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{patientName}&apos;s referral link</DialogTitle></DialogHeader>
          {pending || !code ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: BRAND_COLORS.primaryTeal }} /></div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Referral code</p>
                <p className="text-2xl font-bold font-mono tracking-widest" style={{ color: BRAND_COLORS.primaryTeal }}>{code}</p>
              </div>
              <div className="rounded-md border p-2 text-xs break-all" style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.bodyText }}>{link}</div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium text-white"
                  style={{ backgroundColor: "#25D366" }}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
                <Button
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied") }}
                  className="gap-1.5"
                >
                  <Copy className="h-4 w-4" /> Copy link
                </Button>
              </div>
              <p className="text-[11px] text-center" style={{ color: BRAND_COLORS.borderDivider }}>
                When a friend registers with this link and pays their first visit, you become eligible for a reward.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
