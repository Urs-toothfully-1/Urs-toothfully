/**
 * The payment plan must be built on the DISCOUNTED total.
 *
 * The wizard used to sum quantity × rate on the client and hand that to the
 * Payment Plan step, ignoring the discount — so a 10% discount on ₹79,000
 * produced a schedule for ₹79,000 instead of ₹71,100 and the patient was
 * scheduled to overpay by ₹7,900.
 *
 *   node qa/check-agreement-total.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const wizard = readFileSync(join(root, "components/estimates/EstimateWizard.tsx"), "utf8")

// Tripwire: the raw client-side sum must not be what Step 3 receives.
assert.ok(
  !/estimateTotal=\{estimateInitialItems\.reduce/.test(wizard),
  "regression: the payment plan is again being handed the pre-discount client sum"
)
assert.ok(
  /estimateTotal=\{agreementTotal\}/.test(wizard),
  "the payment plan should receive agreementTotal"
)
assert.ok(
  /estimateTotal !== null && Number\.isFinite\(estimateTotal\)/.test(wizard),
  "agreementTotal should prefer the server-stored total"
)

// The fallback maths, mirrored from the component.
function agreementTotal(storedTotal, items, discountPct) {
  if (storedTotal !== null && Number.isFinite(storedTotal)) return storedTotal
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitRate, 0)
  const pct = discountPct ?? 0
  return pct > 0 ? subtotal - (subtotal * pct) / 100 : subtotal
}

const items = [
  { quantity: 1, unitRate: 9000 },
  { quantity: 2, unitRate: 35000 },
] // subtotal 79,000

assert.equal(agreementTotal(null, items, 0), 79000, "no discount → subtotal")
assert.equal(agreementTotal(null, items, 10), 71100, "10% discount must come off the plan total")
assert.equal(agreementTotal(71100, items, 10), 71100, "the stored total wins")
// The stored total is authoritative even when the client sum disagrees.
assert.equal(agreementTotal(71100, items, 0), 71100, "stored total is not second-guessed")
assert.equal(agreementTotal(null, [], 0), 0, "no items → zero")

console.log("check-agreement-total: all assertions passed")
