"use client"

import { useTransition } from "react"
import {
  setWhatsAppSendingEnabledAction,
  setWhatsAppQueuePausedAction,
  processWhatsAppQueueAction,
} from "@/actions/whatsapp"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, OctagonAlert, Play, Pause, RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

interface Props {
  sendingEnabled: boolean
  queuePaused: boolean
  messageRateLimit: number
  dailySendingLimit: number
  queueSize: number
}

export function AdminControls({ sendingEnabled, queuePaused, messageRateLimit, dailySendingLimit, queueSize }: Props) {
  const [isPending, startTransition] = useTransition()

  function run(fn: () => Promise<{ success?: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await fn()
      if (result.success) toast.success(result.message)
      else toast.error(result.error ?? "Failed")
    })
  }

  return (
    <Card className="border-[#E0E3E5] bg-white">
      <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
          <ShieldCheck className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
          Admin Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {sendingEnabled ? (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setWhatsAppSendingEnabledAction(false))}
              className="h-9 text-white bg-red-600 hover:bg-red-700"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <OctagonAlert className="h-4 w-4 mr-1.5" />}
              Emergency Stop
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setWhatsAppSendingEnabledAction(true))}
              className="h-9 text-white"
              style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
            >
              <Play className="h-4 w-4 mr-1.5" />
              Enable Sending
            </Button>
          )}

          {queuePaused ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || !sendingEnabled}
              onClick={() => run(() => setWhatsAppQueuePausedAction(false))}
              className="h-9"
            >
              <Play className="h-4 w-4 mr-1.5" />
              Resume Queue
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => setWhatsAppQueuePausedAction(true))}
              className="h-9"
            >
              <Pause className="h-4 w-4 mr-1.5" />
              Pause Queue
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !sendingEnabled || queuePaused}
            onClick={() => run(() => processWhatsAppQueueAction())}
            className="h-9"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Process Queue Now
          </Button>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
          <span>Rate limit: <strong>{messageRateLimit}/min</strong></span>
          <span>Daily limit: <strong>{dailySendingLimit}</strong></span>
          <span>Queue size: <strong>{queueSize}</strong></span>
          <span>Limits are configured in API Settings.</span>
        </div>

        {!sendingEnabled && (
          <p className="text-xs font-semibold text-red-600">
            ⛔ EMERGENCY STOP is active — no WhatsApp messages will be sent until sending is re-enabled.
          </p>
        )}
        {sendingEnabled && queuePaused && (
          <p className="text-xs font-semibold text-amber-600">
            ⏸ Queue is paused — messages accumulate but are not sent.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
