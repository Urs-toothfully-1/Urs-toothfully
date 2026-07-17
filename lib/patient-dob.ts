/**
 * Patients stubbed from an online booking have no real date of birth — the
 * public form doesn't ask for one, but Patient.dateOfBirth is required. Those
 * rows carry a sentinel so reception can complete the profile at the desk.
 *
 * Treat the sentinel as "unknown" everywhere it is shown, otherwise the UI
 * cheerfully reports a 126-year-old patient.
 */

/** Sentinel written by appointment-request.service when creating a stub patient. */
export const UNKNOWN_DOB = new Date("1900-01-01T00:00:00Z")

/** True when a DOB is the sentinel (or otherwise implausible). */
export function isUnknownDob(dob: Date | string | null | undefined): boolean {
  if (!dob) return true
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return true
  return d.getUTCFullYear() <= 1900
}

/** Age in whole years, or null when the DOB is unknown. */
export function ageOrNull(dob: Date | string | null | undefined): number | null {
  if (isUnknownDob(dob)) return null
  const d = new Date(dob as Date | string)
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age < 0 || age > 120 ? null : age
}

/** Age for display — an em dash when unknown. */
export function formatAge(dob: Date | string | null | undefined): string {
  const age = ageOrNull(dob)
  return age === null ? "—" : String(age)
}
