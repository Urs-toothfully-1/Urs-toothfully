/**
 * Numeric system settings are stored as free text, so a reader must never trust
 * them. `parseFloat(value ?? "20")` looks safe but the ?? only catches null —
 * an empty string (what the admin form saved when the field was cleared) parses
 * to NaN, and that NaN then flowed into the estimate total as
 * `new Decimal(NaN)`, which the database rejects. The estimate step showed
 * "Advance Required (NaN%)" and every save died with "Failed to save estimate".
 *
 * Read through settingNumber(); write through assertNumericSetting().
 */

/** Numeric settings and the default to fall back on when the stored value is unusable. */
export const NUMERIC_SETTINGS: Record<string, { fallback: number; min: number; max: number; label: string }> = {
  advance_percent: { fallback: 20, min: 0, max: 100, label: "Minimum Advance %" },
  consultation_fee: { fallback: 500, min: 0, max: 1_000_000, label: "Consultation Fee" },
}

/**
 * A finite number from a stored setting, or the fallback when it is missing,
 * blank, or not a number. Never returns NaN or Infinity.
 */
export function settingNumber(raw: string | null | undefined, fallback: number): number {
  const n = Number.parseFloat(String(raw ?? "").trim())
  return Number.isFinite(n) ? n : fallback
}

/** Convenience for the known numeric keys — uses that key's documented default. */
export function numericSetting(key: keyof typeof NUMERIC_SETTINGS | string, raw: string | null | undefined): number {
  const spec = NUMERIC_SETTINGS[key]
  return settingNumber(raw, spec ? spec.fallback : 0)
}

/**
 * Validates a value on the way IN, so a blank or nonsense number can no longer
 * be persisted and break the estimate flow for everyone. Returns an error
 * message, or null when the value is acceptable.
 */
export function assertNumericSetting(key: string, value: string): string | null {
  const spec = NUMERIC_SETTINGS[key]
  if (!spec) return null // not a numeric setting — nothing to check
  const trimmed = value.trim()
  if (!trimmed) return `${spec.label} cannot be empty.`
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return `${spec.label} must be a number.`
  if (n < spec.min || n > spec.max) return `${spec.label} must be between ${spec.min} and ${spec.max}.`
  return null
}
