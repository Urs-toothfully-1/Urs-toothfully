/**
 * Drives the real consultation → estimate flow in a browser and reports whether
 * the estimate actually saves. Point it at an app running against a throwaway
 * database whose advance_percent is the broken empty string.
 *
 *   node qa/ui-estimate-check.mjs [baseUrl]
 */
import { chromium } from "@playwright/test"

const BASE = process.argv[2] ?? "http://localhost:3100"
const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()
const problems = []
page.on("pageerror", (e) => problems.push("pageerror: " + String(e).slice(0, 200)))

async function api(path, opts) {
  const res = await page.request.fetch(BASE + path, opts)
  return { status: res.status(), body: await res.json().catch(() => ({})) }
}

// 1. Log in as the doctor through the real form.
await page.goto(`${BASE}/login`)
await page.getByLabel(/email/i).fill("dr.jashwant@toothfully.in")
await page.getByLabel(/^password$/i).fill("Doctor@123")
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.getByRole("button", { name: /sign in/i }).click()])
console.log("1. logged in as doctor            ✓")

// 2. Work from a visit id passed in (any existing consultation).
const visitId = process.env.VISIT_ID
if (!visitId) throw new Error("set VISIT_ID to an existing visit")
console.log(`2. using visit ${visitId.slice(0, 8)}…            ✓`)

// 3. Open the wizard and go to the estimate step.
await page.goto(`${BASE}/doctor/consultation/${visitId}`)
await page.getByRole("button", { name: /Step 2\s*Estimate/i }).click()
await page.getByText(/Step 2 — Treatment Estimate/i).waitFor()

// 4. The NaN that was on screen must be gone.
const bodyText = await page.locator("body").innerText()
if (/NaN/.test(bodyText)) problems.push('the page still renders "NaN"')
console.log(`3. no NaN on the estimate step     ${/NaN/.test(bodyText) ? "✗" : "✓"}`)
const advanceGone = !/Advance Required/i.test(bodyText)
console.log(`4. advance moved to Payment Plan   ${advanceGone ? "✓" : "✗"}`)
if (!advanceGone) problems.push("Advance Required is still shown on the estimate step")

// 5. Fill a treatment row and save — the thing that kept failing.
const select = page.locator("tbody tr").first().locator("select")
const options = await select.locator("option").all()
let picked = ""
for (const o of options) {
  const v = await o.getAttribute("value")
  if (v && v !== "" && v !== "custom") { picked = v; break }
}
await select.selectOption(picked)
const row = page.locator("tbody tr").first()
await row.locator('input[type="number"]').nth(2).fill("18000")
await row.locator('input[type="number"]').nth(1).fill("3")

await page.getByRole("button", { name: /Create Estimate|Save Estimate/i }).click()

const failed = page.getByText(/Failed to save estimate|could not be calculated/i)
const saved = page.getByText(/Estimate saved/i)
const outcome = await Promise.race([
  failed.waitFor({ timeout: 20000 }).then(() => "FAILED").catch(() => null),
  saved.waitFor({ timeout: 20000 }).then(() => "SAVED").catch(() => null),
])
console.log(`5. estimate save                   ${outcome === "SAVED" ? "✓ SAVED" : "✗ " + (outcome ?? "no response")}`)
if (outcome !== "SAVED") problems.push("estimate did not save: " + (await page.locator("body").innerText()).match(/Failed[^\n]*/)?.[0])

// 6. Confirm the estimates endpoint is healthy.
const est = await api(`/api/estimates?patientId=${process.env.PATIENT_ID ?? ""}`)
console.log(`6. estimates readable via API      ${est.status === 200 ? "✓" : "✗ " + est.status}`)

console.log(problems.length ? "\nPROBLEMS:\n  " + problems.join("\n  ") : "\nALL GOOD — the estimate saves.")
await browser.close()
process.exit(problems.length ? 1 : 0)
