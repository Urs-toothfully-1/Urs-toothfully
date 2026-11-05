// Self-check for WhatsApp automation selection logic: npx tsx scripts/check-automation.ts
import assert from "node:assert"
import { pickRecalls, firstName } from "../server/services/whatsapp/automation.service"

const DAY = 86_400_000
const now = new Date("2026-11-05T15:30:00Z")
const ago = (d: number) => new Date(now.getTime() - d * DAY)
const picks = pickRecalls(
  [
    { patientId: "a", last: ago(200) },
    { patientId: "b", last: ago(300) },
    { patientId: "c", last: ago(190) },
  ],
  new Set(["c"]),
  now
)
assert.deepStrictEqual(picks.map((p) => p.patientId), ["b", "a"], "oldest first, excluded dropped")
assert.deepStrictEqual(picks.map((p) => p.months), [10, 7])
assert.strictEqual(firstName("  Riya  Sen "), "Riya")
assert.strictEqual(pickRecalls(Array.from({ length: 60 }, (_, i) => ({ patientId: `p${i}`, last: ago(200) })), new Set(), now).length, 40)
console.log("automation OK")
