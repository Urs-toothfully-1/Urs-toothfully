import { test, expect } from "@playwright/test"

/**
 * Product & service billing — runs authenticated as receptionist.
 *
 * This path moves money and issues a numbered receipt, so the assertions go
 * past "the dialog opened": the receipt has to appear in the patient's payment
 * history with the right total after a reload.
 */

const PATIENT_PAYMENTS = "/patients/dec8da9d-bf0e-4207-b5e8-ec558a55dcb5/payments"

// One shared patient ledger; parallel runs would race on its totals.
test.describe.configure({ mode: "serial" })

test.describe("Product invoicing", () => {
  test("the Bill Products dialog opens with its category list", async ({ page }) => {
    await page.goto(PATIENT_PAYMENTS)
    await page.getByRole("button", { name: /Bill Products/i }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText(/Bill Products & Services/i)
    // Categories come from a plain module; exported from the action they would
    // arrive undefined and crash this dialog on open.
    await expect(dialog.getByRole("combobox").first()).toContainText("X-ray")
    await expect(page.locator("body")).not.toContainText(/something went wrong/i)
  })

  test("the line total and invoice total follow quantity and price", async ({ page }) => {
    await page.goto(PATIENT_PAYMENTS)
    await page.getByRole("button", { name: /Bill Products/i }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder(/Item name/i).fill("OPG X-ray")
    await dialog.getByPlaceholder("Qty").fill("2")
    await dialog.getByPlaceholder("Price").fill("750")

    await expect(dialog).toContainText("₹1,500")
    await page.getByRole("button", { name: "Cancel" }).click()
  })

  test("a blank line is refused rather than billed", async ({ page }) => {
    await page.goto(PATIENT_PAYMENTS)
    await page.getByRole("button", { name: /Bill Products/i }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Price").fill("500")
    await page.getByRole("button", { name: /Collect & Generate Receipt/i }).click()

    await expect(page.getByText(/Every line needs a name/i)).toBeVisible()
    await expect(dialog).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
  })

  test("billing records the payment and it survives a reload", async ({ page, context }) => {
    // Unique per run: each run bills a real payment, and payments are never
    // hard-deleted, so a fixed name would pile up and match ambiguously.
    const item = `E2E Lab Test ${Date.now()}`
    await page.goto(PATIENT_PAYMENTS)

    // Products get their own total, kept apart from treatment revenue.
    await expect(page.getByText("Products & Services").first()).toBeVisible()

    await page.getByRole("button", { name: /Bill Products/i }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder(/Item name/i).fill(item)
    await dialog.getByPlaceholder("Qty").fill("1")
    await dialog.getByPlaceholder("Price").fill("321")

    // The receipt opens in a new tab on success; accept it so nothing dangles.
    const popupPromise = context.waitForEvent("page").catch(() => null)
    await page.getByRole("button", { name: /Collect & Generate Receipt/i }).click()

    await expect(page.getByText(/Receipt RCP-/i)).toBeVisible()
    const popup = await popupPromise
    if (popup) await popup.close()

    // Reload rather than trusting the optimistic UI. The itemisation must be
    // visible, not just stored — otherwise the history reads only "Products ₹321".
    await page.reload()
    await expect(page.getByText(`${item} (X-ray) × 1 @ ₹321`)).toBeVisible()
    await expect(page.getByText(/Products/).first()).toBeVisible()
  })

  test("a new receipt carries a sequential number, not a timestamp", async ({ page, context }) => {
    const item = `E2E Receipt check ${Date.now()}`
    await page.goto(PATIENT_PAYMENTS)

    await page.getByRole("button", { name: /Bill Products/i }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder(/Item name/i).fill(item)
    await dialog.getByPlaceholder("Price").fill("100")

    const popupPromise = context.waitForEvent("page").catch(() => null)
    await page.getByRole("button", { name: /Collect & Generate Receipt/i }).click()

    // RCP-<year>-<seq> is the clinic's sequence; INV-<epoch> was the bug. The
    // assertion is scoped to the receipt just issued rather than to the whole
    // page, which may still hold rows created before the fix.
    await expect(page.getByText(/Receipt RCP-\d{4}-\d{5}/)).toBeVisible()
    const popup = await popupPromise
    if (popup) await popup.close()
  })
})
