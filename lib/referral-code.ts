// Short, shareable referral codes. Unambiguous alphabet — no 0/O/1/I/L — so a
// code can't be misread or mistyped when read aloud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generateReferralCode(length = 6): string {
  let out = ""
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

/** Normalise user-entered codes: uppercase, strip spaces/dashes. */
export function normalizeReferralCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "").trim()
}
