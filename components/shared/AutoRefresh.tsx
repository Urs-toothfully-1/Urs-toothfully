"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Keeps queue dashboards live without hammering the server.
 *
 * Polls a tiny change-token endpoint (/api/queue/pulse) and only calls
 * router.refresh() when the branch's queue/appointments actually change — so a
 * quiet period costs one cheap query per tick, and the expensive full re-render
 * fires only on a real change.
 *
 * Three guards keep Vercel Edge Requests + Active CPU low:
 *  - Pauses entirely while the tab is hidden.
 *  - Stops polling after `idleMs` of no interaction — a tablet left switched on
 *    overnight makes ZERO requests — and resumes with an immediate refresh the
 *    moment someone touches it again.
 *  - An in-flight guard so a slow response can't stack up.
 *
 * 90s is plenty fresh for a clinic queue; both timings are props if a screen
 * genuinely needs faster liveness.
 */
export function AutoRefresh({
  intervalMs = 90_000,
  idleMs = 20 * 60_000,
}: {
  intervalMs?: number
  idleMs?: number
}) {
  const router = useRouter()
  const lastToken = useRef<string | null>(null)
  const inFlight = useRef(false)
  const lastActivity = useRef(Date.now())

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastActivity.current > idleMs) return // idle — stop polling
      if (inFlight.current) return
      inFlight.current = true
      try {
        const res = await fetch("/api/queue/pulse", { cache: "no-store" })
        if (!res.ok) return
        const { v } = (await res.json()) as { v: string }
        if (lastToken.current === null) {
          // First successful poll — the page already rendered fresh data on
          // load, so just record the baseline and don't refresh.
          lastToken.current = v
        } else if (v !== lastToken.current) {
          lastToken.current = v
          router.refresh()
        }
      } catch {
        // Network blip — ignore and try again next tick.
      } finally {
        inFlight.current = false
      }
    }

    const id = setInterval(check, intervalMs)

    // Any interaction refreshes the activity clock; coming back from idle does
    // an immediate check so the user never lands on stale data.
    const onActivity = () => {
      const wasIdle = Date.now() - lastActivity.current > idleMs
      lastActivity.current = Date.now()
      if (wasIdle) check()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity()
    }

    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const
    for (const e of activityEvents) window.addEventListener(e, onActivity, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearInterval(id)
      for (const e of activityEvents) window.removeEventListener(e, onActivity)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [router, intervalMs, idleMs])

  return null
}
