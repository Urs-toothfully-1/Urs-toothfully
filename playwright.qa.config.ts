import { defineConfig, devices } from "@playwright/test"

/**
 * Config for the deep workflow spec (tests/e2e/journey-ui.spec.ts).
 *
 * Kept separate from playwright.config.ts because that file's projects filter by
 * testMatch per role, while this spec sets its own storage state per describe
 * block and must run serially against a single app instance.
 *
 *   E2E_BASE_URL=http://localhost:3100 npx playwright test -c playwright.qa.config.ts
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results-qa",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "journey",
      testMatch: /journey-ui\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
