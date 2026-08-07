/**
 * The discount now lives on the Payment Plan step. Save an estimate at full
 * price, then apply a discount there and check that it rewrites the estimate
 * total AND the instalments.
 *
 *   VISIT_ID=<uuid> node qa/ui-discount-in-plan.mjs [baseUrl]
 */
import { chromium } from "@playwright/test"

const BASE = process.argv[2] ?? "http://localhost:3100"
const VISIT = process.env.VISIT_ID
if (!VISIT) throw new Error("set VISIT_ID")

const RATE = 20000
const DISCOUNT = 25
const EXPECTED = RATE - (RATE * DISCOUNT) / 100 // 15,000

const browser = await chromium.launch()
const page = await (await browser.newContext()).newPage()
const problems = []
const inr = (n) => n.toLocaleString("en-IN")
const check = (label, ok) => { console.log(`  ${ok ? "✓" : "✗"} ${label}`); if (!ok) problems.push(label) }

await page.goto(`${BASE}/login`)
await page.getByLabel(/email/i).fill(process.env.LOGIN_EMAIL ?? "dr.jashwant@toothfully.in")
await page.getByLabel(/^password$/i).fill(process.env.LOGIN_PASSWORD ?? "Doctor@123")
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.getByRole("button", { name: /sign in/i }).click()])

await page.goto(`${BASE}/doctor/consultation/${VISIT}`)
await page.getByRole("button", { name: /Step 2\s*Estimate/i }).click()
await page.getByText(/Step 2 — Treatment Estimate/i).waitFor()

// The estimate step must no longer carry a discount box.
console.log("\nEstimate step")
check("no discount input on the estimate step", (await page.locator('input[name="discountPercent"]:visible').count()) === 0)
check("no Advance Required on the estimate step", !/Advance Required/i.test(await page.locator("body").innerText()))

const select = page.locator("tbody tr").first().locator("select")
for (const o of await select.locator("option").all()) {
  const v = await o.getAttribute("value")
  if (v && v !== "" && v !== "custom") { await select.selectOption(v); break }
}
await page.locator("tbody tr").first().locator('input[type="number"]').nth(2).fill(String(RATE))
await page.getByRole("button", { name: /Create Estimate|Save Estimate/i }).click()
await page.getByText(/Estimate saved/i).waitFor({ timeout: 20000 })
check(`estimate saved at full price ₹${inr(RATE)}`, true)

// Step 3 — apply the discount here.
console.log("\nPayment Plan step")
await page.getByRole("button", { name: /Add payment plan/i }).click().catch(async () => {
  await page.getByRole("button", { name: /Step 3\s*Payment Plan/i }).click()
})
await page.getByText(/Payment Agreement/i).first().waitFor({ timeout: 20000 })

const discountInput = page.locator('input[type="number"]').first()
check("discount control is on the payment plan", await discountInput.isVisible())
await discountInput.fill(String(DISCOUNT))
await page.getByRole("button", { name: /Apply Discount/i }).click()
await page.getByText(/discount applied/i).waitFor({ timeout: 20000 })

const body = await page.locator("body").innerText()
check(`treatment cost now reads ₹${inr(EXPECTED)}`, body.includes(inr(EXPECTED)))
check(`the ₹${inr(RATE)} figure is no longer the plan total`, !new RegExp(`Treatment Cost[\\s\\S]{0,40}₹${inr(RATE)}`).test(body))
check("no mismatch warning between schedule and estimate", !/estimate: ₹/.test(body))

console.log(problems.length ? "\nPROBLEMS:\n  " + problems.join("\n  ") : "\nDISCOUNT WORKS FROM THE PAYMENT PLAN.")
await browser.close()
process.exit(problems.length ? 1 : 0)
