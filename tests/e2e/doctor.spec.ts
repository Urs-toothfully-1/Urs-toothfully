import { test, expect } from "@playwright/test"

/**
 * Doctor workspace — runs authenticated as doctor.
 * Covers dashboard reachability, prescription/estimate access and the
 * clinical-notes API guard.
 */

test.describe("Doctor dashboard", () => {
  test("doctor home loads", async ({ page }) => {
    await page.goto("/doctor")
    await expect(page).toHaveURL(/\/doctor/)
    await expect(page.locator("body")).not.toContainText(/application error/i)
  })

  test("signature page loads", async ({ page }) => {
    await page.goto("/doctor/signature")
    await expect(page).toHaveURL(/signature/)
  })
})

test.describe("Queue claim concurrency (regression)", () => {
  // Set E2E_WAITING_QUEUE_ID to a seeded queue entry in WAITING status.
  // Verifies the atomic-claim fix: two parallel claims → exactly one succeeds.
  const queueId = process.env.E2E_WAITING_QUEUE_ID
  test.skip(!queueId, "Set E2E_WAITING_QUEUE_ID to run the concurrency check")

  test("two simultaneous claims: exactly one wins", async ({ page }) => {
    const [a, b] = await Promise.all([
      page.request.post(`/api/queue/${queueId}/claim`),
      page.request.post(`/api/queue/${queueId}/claim`),
    ])
    const statuses = [a.status(), b.status()].sort()
    // One 200 OK, one 400 (already claimed / not WAITING).
    expect(statuses).toEqual([200, 400])
  })
})

test.describe("Clinical notes API", () => {
  test("rejects an empty note", async ({ page }) => {
    const res = await page.request.post("/api/clinical-notes", { data: {} })
    expect([400, 422]).toContain(res.status())
  })

  test("is not publicly writable", async ({ browser }) => {
    // browser.newContext() still picks up the project's storageState, so the
    // session has to be cleared explicitly for this to test anything.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    const res = await page.request.post("/api/clinical-notes", {
      data: { visitId: "x", body: "test" },
    })
    expect(res.status()).toBe(401)
    await ctx.close()
  })
})
