/**
 * Dosage vocabulary from the clinic's prescription-format sheet.
 *
 * Offered as suggestions, not a closed set: every field stays free-text so an
 * unusual regimen is never blocked by the dropdown.
 */

/** Morning-afternoon-night pattern. */
export const FREQUENCY_OPTIONS = [
  { value: "1-0-1", label: "1-0-1 — twice daily" },
  { value: "1-1-1", label: "1-1-1 — thrice daily" },
  { value: "1-0-0", label: "1-0-0 — morning only" },
  { value: "0-1-0", label: "0-1-0 — afternoon only" },
  { value: "0-0-1", label: "0-0-1 — night only" },
  { value: "S.O.S", label: "S.O.S — as needed" },
] as const

export const DURATION_OPTIONS = ["1 day", "3 days", "5 days", "7 days", "10 days", "14 days"] as const

export const INSTRUCTION_OPTIONS = ["After food", "Before food", "Empty stomach"] as const

/** Common dose amounts — the strength usually sits in the medicine name. */
export const DOSAGE_OPTIONS = ["1 tab", "2 tabs", "1 cap", "5 ml", "10 ml", "Local application"] as const
