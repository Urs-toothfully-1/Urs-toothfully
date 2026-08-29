"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Keeps queue dashboards live without hammering the server.
 *
 * Instead of blindly re-fetching the whole server-component tree on a short
 * timer (the old behaviour: router.refresh() every 25s — one full Function
 * invocation + every dashboard query, per open tab, all day), this polls a
 * tiny change-token endpoint (/api/queue/pulse) and only calls router.refresh()
 * when the queue has actually changed.
 *
 * Result: the common case is one cheap query per interval, and expensive
 * re-renders happen only when a patient's status/assignment/membership changes.
 * Polling pauses while the tab is hidden and re-checks the moment it's visible.
 *
 * 60s default is plenty fresh for a clinic queue; lower it only if you truly
 * need faster liveness (it scales invocation count linearly).
 */
export function AutoRefresh({ intervalMs = 60000 }: { intervalMs?: number }) {
  const router = useRouter()
  const lastToken = useRef<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return
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
    const onVisibility = () => {
      if (document.visibilityState === "visible") check()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [router, intervalMs])

  return null
}
