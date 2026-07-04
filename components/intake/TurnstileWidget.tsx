"use client"

import { useEffect, useRef } from "react"

/**
 * Cloudflare Turnstile widget. Renders nothing when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured (e.g. LAN kiosk) — the
 * server action skips verification in that case too.
 * The widget injects a hidden "cf-turnstile-response" input into the form.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; theme?: string }) => string
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

export function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    function render() {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, { sitekey: siteKey!, theme: "light" })
      }
    }

    if (window.turnstile) {
      render()
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
      if (!script) {
        script = document.createElement("script")
        script.src = SCRIPT_SRC
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener("load", render)
      return () => script?.removeEventListener("load", render)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={containerRef} className="flex justify-center" />
}
