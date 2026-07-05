"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Silently re-fetches the current server component tree on an interval so
 * queue pages stay live without a manual Refresh. Pauses while the tab is
 * hidden and refreshes immediately when it becomes visible again.
 */
export function AutoRefresh({ intervalMs = 25000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const id = setInterval(tick, intervalMs)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [router, intervalMs])

  return null
}
