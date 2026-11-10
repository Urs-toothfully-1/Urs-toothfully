"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** Pass `x || ""` to show 0 as an empty box. */
  value: number | "" | null | undefined
  onValueChange: (n: number) => void
  min?: number
  max?: number
  integer?: boolean
  /** Only report the number when the box loses focus (for fields that save to the server). */
  commitOnBlur?: boolean
}

/**
 * Number box that can be emptied with backspace. A controlled `value={n}` box
 * that coerces "" back to 0/1 on every keystroke makes "1" un-deletable, so
 * typing 1 gives "11". Here the typed text lives in a draft while focused;
 * valid numbers are passed up as you type, and an empty box falls back to
 * `min` (or 0) only when you leave it.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  integer,
  commitOnBlur,
  onBlur,
  ...rest
}: Props) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const parse = (t: string) => (integer ? parseInt(t, 10) : parseFloat(t))
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))

  return (
    <Input
      {...rest}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      min={min}
      max={max}
      value={draft ?? value ?? ""}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parse(e.target.value)
        if (!commitOnBlur && Number.isFinite(n)) onValueChange(clamp(n))
      }}
      onBlur={(e) => {
        if (draft !== null) {
          const n = parse(draft)
          onValueChange(clamp(Number.isFinite(n) ? n : (min ?? 0)))
          setDraft(null)
        }
        onBlur?.(e)
      }}
    />
  )
}
