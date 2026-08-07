/**
 * End-to-end: save a DISCOUNTED estimate, then check the Payment Plan step is
 * built on the discounted total rather than the pre-discount subtotal.
 *
 *   VISIT_ID=<uuid> node qa/ui-discount-check.mjs [baseUrl]
 */
import { chromium } from "@playwright/test"

const BASE = process.argv[2] ?? "http://localhost:3100"
const VISIT = process.env.VISIT_ID
if (!VISIT) throw new Error("set VISIT_ID")

const RATE = 20000
const DISCOUNT = 10
const EXPECTED_TOTAL = RATE - (RATE * DISCOUNT) / 100 // 18,000

const browser = await chromium.launch()
const page = await (await browser.newContext()).newPage()
const problems = []

await page.goto(`${BASE}/login`)
await page.getByLabel(/email/i).fill("dr.jashwant@toothfully.in")
await page.getByLabel(/^password$/i).fill("Doctor@123")
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.getByRole("button", { name: /sign in/i }).click()])

await page.goto(`${BASE}/doctor/consultation/${VISIT}`)
await page.getByRole("button", { name: /Step 2\s*Estimate/i }).click()
await page.getByText(/Step 2 — Treatment Estimate/i).waitFor()

// One treatment at ₹20,000, then 10% off.
const select = page.locator("tbody tr").first().locator("select")
for (const o of await select.locator("option").all()) {
  const v = await o.getAttribute("value")
  if (v && v !== "" && v !== "custom") { await select.selectOption(v); break }
}
const row = page.locator("tbody tr").first()
await row.locator('input[type="number"]').nth(2).fill(String(RATE))
await page.locator('input[name="discountPercent"]').fill(String(DISCOUNT))
await page.locator('input[name="discountPercent"]').blur()

const totalText = await page.getByText(/^₹/).allInnerTexts()
console.log(`estimate step totals seen: ${totalText.join(" | ")}`)

await page.getByRole("button", { name: /Create Estimate|Save Estimate/i }).click()
await page.getByText(/Estimate saved/i).waitFor({ timeout: 20000 })
console.log(`1. discounted estimate saved                ✓`)

// Step 3 must quote the discounted figure.
await page.getByRole("button", { name: /Add payment plan/i }).click().catch(async () => {
  await page.getByRole("button", { name: /Step 3\s*Payment Plan/i }).click()
})
await page.getByText(/Treatment Cost/i).waitFor({ timeout: 20000 })
const planText = await page.locator("body").innerText()

const fmt = (n) => n.toLocaleString("en-IN")
const showsDiscounted = planText.includes(fmt(EXPECTED_TOTAL))
const showsUndiscounted = new RegExp(`₹\\s*${fmt(RATE)}\\b`).test(planText)

console.log(`2. plan shows discounted ₹${fmt(EXPECTED_TOTAL)}          ${showsDiscounted ? "✓" : "✗"}`)
console.log(`3. plan does NOT show pre-discount ₹${fmt(RATE)} ${showsUndiscounted ? "✗" : "✓"}`)
if (!showsDiscounted) problems.push(`payment plan does not quote the discounted total ₹${fmt(EXPECTED_TOTAL)}`)
if (showsUndiscounted) problems.push(`payment plan still quotes the pre-discount ₹${fmt(RATE)}`)

console.log(problems.length ? "\nPROBLEMS:\n  " + problems.join("\n  ") : "\nDISCOUNT FLOWS INTO THE PAYMENT PLAN CORRECTLY.")
await browser.close()
process.exit(problems.length ? 1 : 0)
