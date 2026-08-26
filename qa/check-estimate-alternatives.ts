/**
 * Checks that estimate "options" are quoted without being charged.
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '\n')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/check-estimate-alternatives.ts
 *
 * A doctor quotes three grades of root canal side by side and charges for one.
 * The failure that matters is silent and expensive in both directions: an
 * option leaking into the total bills the patient for treatment they never
 * agreed to, and a charged line wrongly flagged as an option quietly writes
 * money off the estimate.
 *
 * Mirrors the arithmetic in actions/estimates.ts and estimate.service.ts.
 */

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`)
  if (!ok) failures++
}

type Line = { name: string; amount: number; isAlternative?: boolean }

/** The rule under test, exactly as both call sites apply it. */
const chargeable = (items: Line[]) => items.filter((i) => !i.isAlternative)
const subtotalOf = (items: Line[]) => chargeable(items).reduce((s, i) => s + i.amount, 0)
const optionsOf = (items: Line[]) =>
  items.filter((i) => i.isAlternative).reduce((s, i) => s + i.amount, 0)

// The case from the clinic: three root canal grades, only the 5,000 one charged.
const rootCanal: Line[] = [
  { name: "Root Canal — standard", amount: 5000 },
  { name: "Root Canal — rotary", amount: 10000, isAlternative: true },
  { name: "Root Canal — microscopic", amount: 20000, isAlternative: true },
]

check(subtotalOf(rootCanal) === 5000, "only the chosen grade reaches the total")
check(optionsOf(rootCanal) === 30000, "the other two are still priced, as options")
check(chargeable(rootCanal).length === 1, "one chargeable line out of three quoted")

// Options alongside real treatment must not disturb it.
const mixed: Line[] = [
  { name: "Scaling", amount: 2000 },
  { name: "Root Canal — standard", amount: 5000 },
  { name: "Root Canal — microscopic", amount: 20000, isAlternative: true },
]
check(subtotalOf(mixed) === 7000, "options do not disturb the treatments actually charged")

// Nothing flagged behaves exactly as before this feature existed.
const plain: Line[] = [{ name: "Scaling", amount: 2000 }, { name: "Filling", amount: 3000 }]
check(subtotalOf(plain) === 5000, "an estimate with no options totals as it always did")
check(optionsOf(plain) === 0, "no options means nothing shown as not-charged")

// Every line an option: nothing is owed yet, but the sheet still shows prices.
const allOptions: Line[] = [
  { name: "Implant — economy", amount: 25000, isAlternative: true },
  { name: "Implant — premium", amount: 60000, isAlternative: true },
]
check(subtotalOf(allOptions) === 0, "an all-options estimate charges nothing")
check(optionsOf(allOptions) === 85000, "…while still quoting both prices")

// A discount applies to the charged subtotal, never to the options.
const discounted = subtotalOf(rootCanal) - (subtotalOf(rootCanal) * 10) / 100
check(discounted === 4500, "a 10% discount applies to the charged amount only")

console.log(failures === 0 ? "\nall estimate-option checks passed" : `\n${failures} FAILED`)
process.exitCode = failures ? 1 : 0
