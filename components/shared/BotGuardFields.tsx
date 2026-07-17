"use client"

import { useState, useEffect } from "react"
import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "@/lib/bot-guard"

/**
 * Hidden fields backing the server-side bot checks. Invisible and unreachable
 * for real users; scripted submitters trip one or both.
 *
 * The stamp must live in React state, not be written to the DOM via a ref:
 * React re-syncs `type="hidden"` inputs from props on every render, so a
 * ref-assigned value is wiped as soon as anything else in the form re-renders
 * (e.g. picking a clinic) — which silently rejected every real submission.
 */
export function BotGuardFields() {
  const [loadedAt, setLoadedAt] = useState("")

  // Stamped after mount so it reflects when a real browser loaded the form; a
  // value computed during SSR would reflect render/cache time instead.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount stamp, no cascade
  useEffect(() => {
    setLoadedAt(String(Date.now()))
  }, [])

  return (
    <div aria-hidden="true" className="hidden">
      {/* Honeypot: off-screen, not tabbable, autocomplete off */}
      <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
      <input
        type="text"
        id={HONEYPOT_FIELD}
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
      <input type="hidden" name={TIMESTAMP_FIELD} value={loadedAt} readOnly />
    </div>
  )
}
