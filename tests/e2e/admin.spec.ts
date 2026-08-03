import { test, expect, request as pwRequest } from "@playwright/test"

/**
 * Admin area + WhatsApp + cron security. Runs authenticated as admin.
 */

test.describe("Admin pages load", () => {
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/treatments",
    "/admin/accounting",
    "/admin/audit",
    "/admin/availability",
    "/admin/reports/daily",
    "/admin/reports/monthly",
    "/admin/reports/outstanding",
    "/admin/tally",
  ]) {
    test(`GET ${path} renders without an app error`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")))
      await expect(page.locator("body")).not.toContainText(/application error|unhandled runtime/i)
    })
  }
})

test.describe("Admin API authorization", () => {
  test("accounting is read-only over the API", async ({ baseURL }) => {
    // The request context inherits the project's stored admin session, so this
    // exercises the authorised path: /api/accounting exposes no POST handler —
    // entries are written by the payment flow, never by a client. Hence 405.
    const ctx = await pwRequest.newContext({ baseURL, storageState: "tests/e2e/.auth/admin.json" })
    const res = await ctx.post("/api/accounting", { data: { amount: 100, type: "INCOME" } })
    expect(res.status()).toBe(405)
    await ctx.dispose()
  })

  test("accounting write is refused without a session", async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
    const res = await ctx.post("/api/accounting", { data: { amount: 100, type: "INCOME" } })
    expect([401, 403]).toContain(res.status())
    await ctx.dispose()
  })

  test("daily report API returns data for admin", async ({ page }) => {
    const res = await page.request.get("/api/reports/daily")
    expect(res.status()).not.toBe(401)
  })
})

test.describe("WhatsApp webhook security (public endpoint)", () => {
  test("rejects a POST without a valid signature", async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL })
    const res = await ctx.post("/api/whatsapp/webhook", {
      headers: { "content-type": "application/json" },
      data: { object: "whatsapp_business_account", entry: [] },
    })
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })

  test("verification handshake fails on a bad token", async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL })
    const res = await ctx.get(
      "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123",
    )
    expect(res.status()).toBe(403)
    await ctx.dispose()
  })
})

test.describe("Cron endpoint security", () => {
  test("rejects a request with a wrong bearer token", async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL })
    const res = await ctx.get("/api/cron/daily", {
      headers: { authorization: "Bearer definitely-wrong" },
    })
    // 401 when a secret is configured, 503 when it is not — both prove it is not open.
    expect([401, 503]).toContain(res.status())
    await ctx.dispose()
  })
})
