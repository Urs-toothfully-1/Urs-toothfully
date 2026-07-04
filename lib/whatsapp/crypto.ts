import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

/**
 * AES-256-GCM encryption for WhatsApp API credentials stored in the database.
 * Key is derived from WHATSAPP_TOKEN_KEY (preferred) or JWT_SECRET so no extra
 * infrastructure is required. Ciphertext format: iv.authTag.payload (base64).
 */

function getKey(): Buffer {
  const secret = process.env.WHATSAPP_TOKEN_KEY || process.env.JWT_SECRET
  if (!secret || secret.trim().length < 32) {
    throw new Error("WHATSAPP_TOKEN_KEY or JWT_SECRET (32+ chars) required to encrypt credentials")
  }
  return createHash("sha256").update(secret.trim()).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload")
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8")
}

/** Masks a secret for display, e.g. "EAAG…k3Zx" */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "••••••••"
  return `${plain.slice(0, 4)}••••••••${plain.slice(-4)}`
}
