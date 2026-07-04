/**
 * Phone validation + normalization for WhatsApp sending and patient intake.
 * Rejects obviously fake numbers (repeated/sequential digits) and normalizes
 * to E.164 digits without "+" (e.g. "919876543210") for the Cloud API.
 */

// Country calling codes the clinic realistically serves. Numbers with any
// other prefix (when longer than 10 digits) are rejected.
const KNOWN_COUNTRY_CODES = ["91", "1", "44", "61", "65", "971", "966", "880", "977"]

const SEQUENTIAL_PATTERNS = [
  "1234567890", "0123456789", "0987654321", "9876543210",
]

export interface PhoneValidationResult {
  valid: boolean
  /** E.164 digits without "+", only set when valid */
  normalized?: string
  error?: string
}

/** True for junk like 1111111111, 0000000000, 1234567890. */
export function isFakeNumber(digits: string): boolean {
  const local = digits.length > 10 ? digits.slice(-10) : digits
  if (/^(\d)\1+$/.test(local)) return true // all same digit
  if (SEQUENTIAL_PATTERNS.includes(local)) return true
  return false
}

/**
 * Validates a mobile number and normalizes it for WhatsApp.
 * Accepts a local 10-digit Indian number (default) or a full international
 * number with country code.
 */
export function validateMobile(input: string, defaultCountryCode = "91"): PhoneValidationResult {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "")

  if (digits.length < 10) return { valid: false, error: "Phone number is too short" }
  if (digits.length > 15) return { valid: false, error: "Phone number is too long" }
  if (isFakeNumber(digits)) return { valid: false, error: "This phone number is not valid" }

  if (digits.length === 10) {
    // Indian mobiles start with 6-9
    if (defaultCountryCode === "91" && !/^[6-9]/.test(digits)) {
      return { valid: false, error: "Enter a valid 10-digit mobile number" }
    }
    return { valid: true, normalized: `${defaultCountryCode}${digits}` }
  }

  // Longer than 10 digits → must start with a known country code
  const hasKnownCode = KNOWN_COUNTRY_CODES.some(
    (cc) => digits.startsWith(cc) && digits.length - cc.length >= 8 && digits.length - cc.length <= 12
  )
  if (!hasKnownCode) return { valid: false, error: "Invalid country code" }

  return { valid: true, normalized: digits }
}
