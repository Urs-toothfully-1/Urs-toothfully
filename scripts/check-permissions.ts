// Self-check for per-user access rules: npx tsx scripts/check-permissions.ts
import assert from "node:assert"
import { effectivePerms, toOverrides, keysForRole, PRESETS, PERMISSION_KEYS } from "../lib/permissions"

// No stored overrides = exactly today's role behaviour.
const doc = effectivePerms("DOCTOR", null)
assert.ok(doc.allPatients && doc.prices && doc.payments && doc.estimates && doc.prescriptions && doc.clinicalNotes)
assert.ok(!doc.collectPayments && !doc.queue && !doc.whatsapp && !doc.editPatients, "doctor never gains reception features")
const rec = effectivePerms("RECEPTIONIST", undefined)
assert.ok(rec.collectPayments && rec.queue && rec.whatsapp && rec.editPatients && rec.appointments)
assert.ok(!rec.estimates && !rec.prescriptions && !rec.clinicalNotes, "reception never gains clinical features")
assert.ok(PERMISSION_KEYS.every((k) => effectivePerms("ADMIN", { prices: false })[k]), "admin can't be limited")

// The dentist's example: prescription-only doctor.
const rx = effectivePerms("DOCTOR", toOverrides("DOCTOR", Object.fromEntries(PRESETS.DOCTOR.find((p) => p.id === "rx-only")!.off.map((k) => [k, false]))))
assert.ok(rx.prescriptions && !rx.allPatients && !rx.prices && !rx.payments && !rx.estimates && !rx.clinicalNotes)

// Estimates and billing can't survive without prices.
assert.ok(!effectivePerms("DOCTOR", { prices: false }).estimates)
assert.ok(!effectivePerms("RECEPTIONIST", { prices: false }).collectPayments)

// Overrides only store OFF keys that apply to the role; all-on stores nothing.
assert.deepStrictEqual(toOverrides("DOCTOR", { prices: false, queue: false }), { prices: false })
assert.strictEqual(toOverrides("RECEPTIONIST", { prices: true }), null)
assert.strictEqual(toOverrides("ADMIN", { prices: false }), null)

// Every preset only switches off keys its role actually has.
for (const role of ["DOCTOR", "RECEPTIONIST"] as const)
  for (const p of PRESETS[role]) assert.ok(p.off.every((k) => keysForRole(role).includes(k)), `${role}/${p.id}`)

console.log("permissions OK")
