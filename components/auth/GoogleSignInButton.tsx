"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// Minimal shape of the Google Identity Services global we use.
interface GoogleCredentialResponse { credential: string }
interface GoogleId {
  initialize(cfg: { client_id: string; callback: (r: GoogleCredentialResponse) => void }): void
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } }
  }
}

const roleHome = (role: string) =>
  role === "ADMIN" ? "/admin" : role === "DOCTOR" ? "/doctor" : "/reception"

export function GoogleSignInButton() {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false

    async function onCredential(resp: GoogleCredentialResponse) {
      setBusy(true)
      setError(null)
      try {
        const r = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ credential: resp.credential }),
        })
        if (r.ok) {
          const data = await r.json()
          window.location.href = roleHome(data.user.role)
          return
        }
        const d = await r.json().catch(() => ({}))
        setError(d.error ?? "Google sign-in failed.")
      } catch {
        setError("Network error during Google sign-in.")
      }
      setBusy(false)
    }

    function init() {
      const gid = window.google?.accounts?.id
      if (!gid || !ref.current || cancelled) return false
      gid.initialize({ client_id: CLIENT_ID!, callback: onCredential })
      gid.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width: 300,
        text: "signin_with",
        shape: "rectangular",
      })
      return true
    }

    if (!init()) {
      const t = setInterval(() => {
        if (init()) clearInterval(t)
      }, 200)
      return () => { cancelled = true; clearInterval(t) }
    }
    return () => { cancelled = true }
  }, [])

  if (!CLIENT_ID) return null

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div className="flex flex-col items-center gap-2">
        <div ref={ref} aria-busy={busy} />
        {busy && <p className="text-xs" style={{ color: "#707882" }}>Signing you in…</p>}
        {error && <p className="text-xs text-center text-red-600">{error}</p>}
      </div>
    </>
  )
}
