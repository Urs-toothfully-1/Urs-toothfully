// Self-check for who may get a WhatsApp message: npx tsx qa/check-consent.ts
import { mayMessage, WHATSAPP_TRIGGERS as T } from "../lib/whatsapp/templates"

const ok = (c: boolean, m: string) => {
  if (!c) throw new Error(`FAIL: ${m}`)
}
const opted = { consented: true, revokedAt: null }
const stopped = { consented: false, revokedAt: new Date() }

ok(mayMessage(null, T.APPOINTMENT_REMINDER), "booking message to someone never asked")
ok(mayMessage(null, T.APPOINTMENT_CANCELLED), "cancellation to someone never asked")
ok(!mayMessage(null, T.DENTAL_RECALL), "no recall without opt-in")
ok(!mayMessage(null, null), "no manual send without opt-in")
ok(mayMessage(opted, T.DENTAL_RECALL), "opted-in gets recall")
ok(!mayMessage(stopped, T.APPOINTMENT_REMINDER), "STOP blocks even booking messages")
ok(!mayMessage(stopped, T.DENTAL_RECALL), "STOP blocks recall")
console.log("consent OK")
