/** The dropdown value meaning "not in the treatment master — I'll type it". */
export const CUSTOM_TREATMENT = "custom"

/**
 * The treatmentId to store for an estimate item, or undefined for a custom one.
 *
 * A custom treatment has no TreatmentMaster row, so the "custom" sentinel and
 * the empty string must never reach Prisma — connecting a non-existent treatment
 * throws a foreign-key error that surfaces as "Failed to save estimate".
 * Both the create and the update path go through here.
 */
export function treatmentIdOrNull(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : ""
  return s && s !== CUSTOM_TREATMENT ? s : undefined
}
