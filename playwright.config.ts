import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for Toothfully.
 *
 * Auth model: a `setup` project logs in as each role once and saves the session
 * cookie to `tests/e2e/.auth/<role>.json`. Feature specs reuse that storage state
 * so every test starts already authenticated and isolated (fresh browser context).
 *
 * Environment:
 *   E2E_BASE_URL   – app URL under test (default http://localhost:3000)
 *   PW_EXECUTABLE  – optional explicit Chromium path (used in sandboxed CI where the
 *                    normal Playwright browser download is blocked). Leave unset locally.
 *
 * Prerequisites for a green run: the app must be running against a seeded database
 * (`npm run db:seed`) so the seed logins below exist. See tests/e2e/README.md.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const executablePath = process.env.PW_EXECUTABLE || undefined

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { outputFolder: "tests/e2e/.report", open: "never" }]],

  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Auto-waiting is used everywhere; no fixed timeouts in specs.
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // 1. Authenticate each role, persist storage state.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // 2. Public / unauthenticated specs (no stored state).
    {
      name: "public",
      testMatch: /(smoke|public|rbac)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },

    // 3. Authenticated feature specs, one project per role.
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/admin.json",
        launchOptions: { executablePath },
      },
    },
    {
      name: "doctor",
      testMatch: /(doctor|prescriptions|templates|prescription-editor)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/doctor.json",
        launchOptions: { executablePath },
      },
    },
    {
      name: "reception",
      testMatch: /(patients|reception|estimates|product-invoice)\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/reception.json",
        launchOptions: { executablePath },
      },
    },
  ],

  /**
   * Uncomment to let Playwright start the dev server automatically.
   * Requires a seeded database reachable via DATABASE_URL.
   */
  // webServer: {
  //   command: "npm run dev",
  //   url: BASE_URL,
  //   timeout: 120_000,
  //   reuseExistingServer: !process.env.CI,
  // },
})
