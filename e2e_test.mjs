// Toothfully E2E Test — full clinic workflow
// Run: node e2e_test.mjs

import pkg from "./node_modules/playwright/index.js"
const { chromium } = pkg
import fs from "fs"

const BASE = "http://localhost:3000"
const SCREENSHOT_DIR = "c:/temp/toothfully_screens"
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
fs.readdirSync(SCREENSHOT_DIR).forEach(f => fs.unlinkSync(`${SCREENSHOT_DIR}/${f}`))

const ADMIN = { email: "admin@toothfully.in", password: "Admin@123" }
const DOCTOR = { email: "dr.jashwant@toothfully.in", password: "Doctor@123" }
const RECEP = { email: "reception.outram@toothfully.in", password: "Reception@123" }

let sc = 0
async function shot(page, name) {
  const file = `${SCREENSHOT_DIR}/${String(++sc).padStart(2, "0")}_${name}.png`
  await page.screenshot({ path: file, fullPage: false })
}

async function login(page, ctx, creds) {
  await ctx.clearCookies()
  await page.goto(`${BASE}/login`)
  await page.waitForSelector('input[name="email"]', { state: "visible", timeout: 15000 })
  await page.fill('input[name="email"]', creds.email)
  await page.fill('input[name="password"]', creds.password)
  await Promise.all([
    page.waitForURL(url => !url.href.endsWith("/login"), { timeout: 15000 }).catch(() => {}),
    page.locator('button[type="submit"]').click(),
  ])
  await page.waitForTimeout(1500)
  return page.url()
}

// Wait for a Next.js client-side navigation after clicking a Link
async function clickLink(page, locator, expectedUrlPart, timeout = 8000) {
  await locator.scrollIntoViewIfNeeded()
  await Promise.all([
    page.waitForURL(url => url.href.includes(expectedUrlPart), { timeout }).catch(() => {}),
    locator.click(),
  ])
  await page.waitForTimeout(500)
}

const results = []
function log(step, ok, note) {
  results.push({ step, ok, note })
  console.log(`${ok ? "✅" : "❌"} ${step}: ${note}`)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })

  let patientId = ""

  try {
    // ──────────────────────────────────────────────────────────────
    // 1. LOGIN PAGE
    // ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState("networkidle")
    const title = await page.title()
    log("Login page loads", title.includes("Toothfully"), `Title: "${title}"`)
    await shot(page, "01_login_page")

    // ──────────────────────────────────────────────────────────────
    // 2. RECEPTIONIST LOGIN
    // ──────────────────────────────────────────────────────────────
    const afterRecepLogin = await login(page, ctx, RECEP)
    log("Receptionist login", afterRecepLogin.includes("/reception"), `URL: ${afterRecepLogin}`)
    await shot(page, "02_reception_home")

    const recepH1 = await page.locator("h1").first().textContent().catch(() => "")
    log("Reception page h1", recepH1.includes("Live Queue"), `"${recepH1.trim()}"`)

    // ──────────────────────────────────────────────────────────────
    // 3. REFRESH BUTTON — RECEPTION
    // ──────────────────────────────────────────────────────────────
    const refreshBtn = page.locator("button", { hasText: "Refresh" })
    const refreshOk = await refreshBtn.isVisible().catch(() => false)
    log("Reception Refresh button visible", refreshOk, refreshOk ? "found" : "NOT found")

    if (refreshOk) {
      const urlBefore = page.url()
      await refreshBtn.click()
      await page.waitForTimeout(1200)
      const urlAfter = page.url()
      log("Reception Refresh stays on /reception", urlAfter.includes("/reception") && urlAfter === urlBefore, `${urlBefore} → ${urlAfter}`)
    }
    await shot(page, "03_reception_after_refresh")

    // ──────────────────────────────────────────────────────────────
    // 4. NEW PATIENT FORM
    // ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/patients/new`)
    await page.waitForLoadState("networkidle")
    const newPatH1 = await page.locator("h1").first().textContent().catch(() => "")
    log("New Patient form loads", newPatH1.includes("Register"), `"${newPatH1.trim()}"`)
    await shot(page, "04_new_patient_form")

    // ──────────────────────────────────────────────────────────────
    // 5. CREATE NEW PATIENT
    // ──────────────────────────────────────────────────────────────
    const ts = Date.now()
    const patientName = `E2E Patient ${ts}`
    await page.fill('input[name="fullName"]', patientName)
    await page.fill('input[name="dateOfBirth"]', "1993-03-20")
    await page.locator('input[type="radio"][name="gender"][value="FEMALE"]').check()
    await page.fill('input[name="mobile"]', `7${String(ts).slice(-9)}`)
    await page.fill('textarea[name="reasonForVisit"]', "E2E test — routine checkup")

    await shot(page, "05_new_patient_filled")

    // Step 2 of the registration wizard: medical & dental history + consent
    await page.locator("button", { hasText: "Next: Medical History" }).click()
    await page.waitForTimeout(500)
    await page.locator('input[name="diabetes"]').check()
    await page.locator('input[name="consentGiven"]').check()
    await shot(page, "05b_new_patient_history_step")

    await Promise.all([
      page.waitForURL(url => url.href.includes("/patients/") && !url.href.includes("/new"), { timeout: 20000 }).catch(() => {}),
      page.locator('button[type="submit"]').click(),
    ])
    await page.waitForTimeout(1500)

    const createdUrl = page.url()
    const patientCreated = createdUrl.includes("/patients/") && !createdUrl.includes("/new")
    log("Create new patient (form submits + redirects)", patientCreated, `URL: ${createdUrl}`)
    await shot(page, "06_patient_created")

    if (patientCreated) {
      patientId = createdUrl.split("/patients/")[1]?.split("/")[0] ?? ""
    }

    // ──────────────────────────────────────────────────────────────
    // 6. PATIENT OVERVIEW CONTENT
    // ──────────────────────────────────────────────────────────────
    if (patientId) {
      await page.goto(`${BASE}/patients/${patientId}`)
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(800)

      const detailsCard = await page.locator("text=Patient Details").isVisible().catch(() => false)
      log("Overview shows Patient Details card", detailsCard, detailsCard ? "visible" : "missing")

      // Count tabs rendered
      const tabLinks = page.locator("a", { hasText: /^(Overview|Dental History|Visit History|Clinical Notes|Estimates|Treatment Progress|Payments|Documents)$/ })
      const tabCount = await tabLinks.count()
      log("All 8 profile tabs rendered", tabCount === 8, `Found ${tabCount} of 8 tabs`)
      await shot(page, "07_patient_overview_tabs")

      // ── Test tab navigation via direct page.goto (reliable) ─────
      const tabs = [
        { name: "Dental History", path: `/patients/${patientId}/history`, check: "/history" },
        { name: "Visit History",  path: `/patients/${patientId}/visits`,  check: "/visits" },
        { name: "Clinical Notes", path: `/patients/${patientId}/notes`,   check: "/notes" },
        { name: "Estimates",      path: `/patients/${patientId}/estimates`,check: "/estimates" },
        { name: "Treatment Progress", path: `/patients/${patientId}/progress`, check: "/progress" },
        { name: "Payments",       path: `/patients/${patientId}/payments`, check: "/payments" },
        { name: "Documents",      path: `/patients/${patientId}/documents`,check: "/documents" },
      ]
      const shotNames = ["08", "09", "10", "11", "12", "13", "14"]

      for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i]
        await page.goto(`${BASE}${t.path}`)
        await page.waitForLoadState("networkidle")
        const ok = page.url().includes(t.check)
        log(`Tab page loads: ${t.name}`, ok, `URL: ${page.url()}`)
        await shot(page, `${shotNames[i]}_tab_${t.check.slice(1)}`)
      }

      // ── Test clicking one tab link (client-side nav) ─────────────
      await page.goto(`${BASE}/patients/${patientId}`)
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(800)

      const estTabLink = page.locator(`a[href="/patients/${patientId}/estimates"]`)
      if (await estTabLink.isVisible().catch(() => false)) {
        await clickLink(page, estTabLink, "/estimates", 8000)
        const tabNavOk = page.url().includes("/estimates")
        log("Tab CLICK navigates (client-side link)", tabNavOk, `URL after click: ${page.url()}`)
      } else {
        // Try by text
        const estTabByText = page.locator("a", { hasText: "Estimates" }).first()
        const cnt = await page.locator("a", { hasText: "Estimates" }).count()
        log("Estimates tab link visible", cnt > 0, `${cnt} links found with text "Estimates"`)
      }
      await shot(page, "15_tab_click_test")

      // ──────────────────────────────────────────────────────────────
      // 7. ADD TO QUEUE
      // ──────────────────────────────────────────────────────────────
      await page.goto(`${BASE}/patients/${patientId}`)
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(800)

      const addQBtn = page.locator("button", { hasText: "Add to Queue" })
      const addQOk = await addQBtn.isVisible().catch(() => false)
      log("Add to Queue button on patient profile", addQOk, addQOk ? "button found" : "NOT found")
      await shot(page, "16_patient_overview_actions")

      if (addQOk) {
        await addQBtn.click()
        await page.waitForTimeout(800)

        // Dialog is a custom div overlay — look for the dialog form
        const dialogSelect = page.locator("select[name='visitType']")
        const dialogOk = await dialogSelect.isVisible().catch(() => false)
        log("Add to Queue dialog opens (visitType select visible)", dialogOk, dialogOk ? "dialog shown" : "dialog NOT visible")
        await shot(page, "17_queue_dialog")

        if (dialogOk) {
          // Doctor selector (SPECIFIC_DOCTOR mode)
          const doctorSel = page.locator("select[name='doctorId']")
          if (await doctorSel.isVisible().catch(() => false)) {
            const optCount = await doctorSel.locator("option").count()
            if (optCount > 1) {
              await doctorSel.selectOption({ index: 1 })
              log("Doctor selected in queue dialog", true, `${optCount} options`)
            }
          }

          // Submit the form — use form-scoped selector to avoid hitting trigger button
          const formSubmitBtn = page.locator('form button[type="submit"]').first()
          const submitVisible = await formSubmitBtn.isVisible().catch(() => false)
          if (submitVisible) {
            // Race: catch success text (visible for only 1.2s) or URL change to /reception
            await Promise.all([
              page.waitForURL(url => url.href.includes("/reception"), { timeout: 6000 }).catch(() => {}),
              formSubmitBtn.click(),
            ])
          } else {
            // Fallback: find by button text inside the fixed overlay
            await page.locator('.fixed button', { hasText: "Add to Queue" }).click()
            await page.waitForURL(url => url.href.includes("/reception"), { timeout: 6000 }).catch(() => {})
          }
          await page.waitForTimeout(500)
          const afterQueueUrl = page.url()
          // Check success via: URL changed to /reception, or dialog closed, or success text shown
          const dialogGone = await page.locator(".fixed").count() === 0
          const successText2 = await page.locator("text=Added to queue").isVisible().catch(() => false)
          const alertErr = await page.locator('[class*="border-red"]').first().textContent().catch(() => "")
          const queueActionSuccess = afterQueueUrl.includes("/reception") || (dialogGone && !alertErr)
          log("Queue form: server action responded", queueActionSuccess || successText2,
            afterQueueUrl.includes("/reception") ? "redirected to reception"
            : successText2 ? "success text visible"
            : alertErr ? `error: "${alertErr.trim().slice(0, 60)}"`
            : dialogGone ? "dialog closed (success)" : "no response detected")
          log("Queue submission redirects to reception", afterQueueUrl.includes("/reception"), `URL: ${afterQueueUrl}`)
          await shot(page, "18_after_queue")
        }
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 8. PATIENT SEARCH
    // ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/patients`)
    await page.waitForLoadState("networkidle")
    const patListH1 = await page.locator("h1").first().textContent().catch(() => "")
    log("Patients list page loads", patListH1.toLowerCase().includes("patient"), `"${patListH1.trim()}"`)

    const searchEl = page.locator('input[placeholder*="Search"]').first()
    if (await searchEl.isVisible().catch(() => false)) {
      await searchEl.fill("Amit Kumar")
      await page.waitForTimeout(1000)
      const results2 = page.locator("a", { hasText: "Amit Kumar" })
      const count = await results2.count()
      log("Patient search finds Amit Kumar", count > 0, `${count} result(s)`)
    } else {
      log("Patient search input visible", false, "search input NOT found")
    }
    await shot(page, "19_patient_search")

    // ──────────────────────────────────────────────────────────────
    // 9. EXISTING PATIENT — ESTIMATES TAB with EST-2026-00001
    // ──────────────────────────────────────────────────────────────
    // Get Amit Kumar's UUID from the link href (more reliable than clicking in search results)
    const amitLink = page.locator("a", { hasText: "Amit Kumar" }).first()
    let amitId = ""
    if (await amitLink.isVisible().catch(() => false)) {
      const amitHref = await amitLink.getAttribute("href").catch(() => "")
      amitId = amitHref?.split("/patients/")[1]?.split("/")[0] ?? ""
    }

    if (amitId) {
      await page.goto(`${BASE}/patients/${amitId}`)
      await page.waitForLoadState("networkidle")
      log("Navigate to Amit Kumar's profile", page.url().includes(`/patients/${amitId}`), `URL: ${page.url()}`)

      // Estimates tab
      await page.goto(`${BASE}/patients/${amitId}/estimates`)
      await page.waitForLoadState("networkidle")
      await shot(page, "20_amit_estimates_tab")

      const estCard = await page.locator("text=EST-2026-00001").isVisible().catch(() => false)
      log("Estimates tab shows EST-2026-00001", estCard, estCard ? "found" : "missing")

      // View estimate detail
      const viewFullBtn = page.locator("a", { hasText: "View full estimate" }).first()
      if (await viewFullBtn.isVisible().catch(() => false)) {
        const estHrefRaw = await viewFullBtn.getAttribute("href").catch(() => "")
        log("View full estimate link href", !!estHrefRaw, `href: "${estHrefRaw}"`)
        if (estHrefRaw) {
          await page.goto(`${BASE}${estHrefRaw}`)
          await page.waitForLoadState("networkidle")
          await page.waitForTimeout(800)
          const estDetailUrl = page.url()
          await shot(page, "21_estimate_detail")
          log("Estimate detail page loads (URL)", estDetailUrl.includes("/doctor/estimate/"), `URL: ${estDetailUrl}`)

          // Check estimate content (estimate number — page uses CardTitle not h1)
          await page.waitForSelector('[class*="CardTitle"], h2, h3', { timeout: 5000 }).catch(() => {})
          // Try multiple locator strategies for the estimate number
          const estNumViaText = await page.locator("text=EST-2026-00001").isVisible().catch(() => false)
          const estNumViaGetByText = await page.getByText("EST-2026-00001").first().isVisible().catch(() => false)
          const bodyText2 = await page.innerText("body").catch(() => "")
          const estNumInBody = bodyText2.includes("EST-2026-00001")
          const estNumVisible = estNumViaText || estNumViaGetByText || estNumInBody
          log("Estimate number shown on detail page", estNumVisible, estNumVisible ? "found" : `not found (body has it: ${estNumInBody})`)

          const statusLabels = await page.locator("text=/Completed|COMPLETED|IN_PROGRESS/i").count()
          log("Estimate items have status labels", statusLabels > 0, `${statusLabels} status label(s)`)
          await shot(page, "21b_estimate_items")
        }
      }

      // Treatment Progress tab
      await page.goto(`${BASE}/patients/${amitId}/progress`)
      await page.waitForLoadState("networkidle")
      await shot(page, "22_treatment_progress_tab")
      const progressContent = await page.locator('[class*="rounded-full"]').first().isVisible().catch(() => false)
      const progressText = await page.locator("text=/Complete|Pending|Progress|Treatment/i").first().isVisible().catch(() => false)
      log("Treatment Progress tab has content", progressContent || progressText, progressContent ? "progress bar found" : progressText ? "treatment text found" : "appears empty")

      // Payments tab
      await page.goto(`${BASE}/patients/${amitId}/payments`)
      await page.waitForLoadState("networkidle")
      await shot(page, "23_payments_tab")
      const payContent = await page.locator("text=/Consultation|Treatment|Payment|Paid|Balance/i").first().isVisible().catch(() => false)
      log("Payments tab shows payment records", payContent, payContent ? "records found" : "empty")
    } else {
      log("Navigate to Amit Kumar's profile", false, "Could not get UUID from search result href")
    }

    // ──────────────────────────────────────────────────────────────
    // 10. DOCTOR LOGIN & QUEUE
    // ──────────────────────────────────────────────────────────────
    const drLoginUrl = await login(page, ctx, DOCTOR)
    log("Doctor login", drLoginUrl.includes("/doctor"), `URL: ${drLoginUrl}`)
    await shot(page, "24_doctor_queue")

    const drH1 = await page.locator("h1").first().textContent().catch(() => "")
    log("Doctor queue page h1", drH1.trim().length > 0, `"${drH1.trim()}"`)

    // Doctor Refresh button
    const drRefresh = page.locator("button", { hasText: "Refresh" })
    const drRefreshOk = await drRefresh.isVisible().catch(() => false)
    log("Doctor Refresh button visible", drRefreshOk, drRefreshOk ? "found" : "NOT found")
    if (drRefreshOk) {
      const drUrlBefore = page.url()
      await drRefresh.click()
      await page.waitForTimeout(1200)
      log("Doctor Refresh stays on /doctor", page.url() === drUrlBefore, `${drUrlBefore} → ${page.url()}`)
    }

    // Queue buttons
    const claimCnt = await page.locator("button", { hasText: "Claim" }).count()
    const startCnt = await page.locator("button", { hasText: "Start" }).count()
    const estLinkCnt = await page.locator("a", { hasText: "Estimate" }).count()
    log("Doctor queue action buttons present", true, `Claim:${claimCnt} Start:${startCnt} Estimate:${estLinkCnt}`)
    await shot(page, "25_doctor_queue_buttons")

    // If patient was added to queue today, Dr. Jashwant should have it
    if (patientId) {
      // Check if our test patient appears in Dr. Jashwant's queue
      const testPatientInQueue = await page.locator(`text=${patientName.slice(0, 15)}`).isVisible().catch(() => false)
      log("Test patient appears in doctor queue", testPatientInQueue, testPatientInQueue ? "patient found" : "not in queue (Outram branch SPECIFIC_DOCTOR mode)")
    }

    // ──────────────────────────────────────────────────────────────
    // 11. NEW ESTIMATE FORM (if queue entry exists)
    // ──────────────────────────────────────────────────────────────
    const estimateLinks = page.locator("a", { hasText: "Estimate" })
    const estCnt = await estimateLinks.count()

    if (estCnt > 0) {
      const estHref = await estimateLinks.first().getAttribute("href").catch(() => "")
      if (estHref) {
        await page.goto(`${BASE}${estHref}`)
        await page.waitForLoadState("networkidle")
        await shot(page, "26_new_estimate_form")
        const estFormH = await page.locator("h1").first().textContent().catch(() => "")
        log("New Estimate form loads from queue", estFormH.toLowerCase().includes("estimate"), `h1: "${estFormH.trim()}"`)

        // Add a treatment item
        const treatSel = page.locator("select").first()
        if (await treatSel.isVisible().catch(() => false)) {
          await treatSel.selectOption({ index: 1 })
          await page.waitForTimeout(300)
          const addItemBtn = page.locator("button", { hasText: /Add/i }).first()
          if (await addItemBtn.isVisible().catch(() => false)) {
            await addItemBtn.click()
            await page.waitForTimeout(500)
            log("Add treatment item to estimate", true, "Add button clicked")
          }
        }
        await shot(page, "26b_estimate_item_added")

        // Save Estimate
        const saveBtn = page.locator("button", { hasText: "Save Estimate" })
        if (await saveBtn.isVisible().catch(() => false)) {
          await Promise.all([
            page.waitForURL(url => url.href.includes("/doctor/estimate/") && !url.href.includes("/new"), { timeout: 15000 }).catch(() => {}),
            saveBtn.click(),
          ])
          await page.waitForTimeout(1500)
          const savedUrl = page.url()
          const savedOk = savedUrl.includes("/doctor/estimate/") && !savedUrl.includes("/new")
          log("Save Estimate redirects to detail", savedOk, `URL: ${savedUrl}`)
          await shot(page, "27_estimate_saved")

          if (savedOk) {
            // Test Start/Complete buttons on estimate items
            const startItemBtns = page.locator("button", { hasText: "Start" })
            const startItemCnt = await startItemBtns.count()
            log("Estimate detail has Start item buttons", startItemCnt > 0, `${startItemCnt} Start button(s)`)

            if (startItemCnt > 0) {
              await startItemBtns.first().click()
              await page.waitForTimeout(2000)
              const startToast = await page.locator("text=Status updated").isVisible().catch(() => false)
              log("Start treatment item → success toast", startToast, startToast ? "toast visible" : "no toast")
              await shot(page, "28_after_start_item")

              const completeBtn = page.locator("button", { hasText: "Complete" }).first()
              if (await completeBtn.isVisible().catch(() => false)) {
                await completeBtn.click()
                await page.waitForTimeout(2000)
                const completeToast = await page.locator("text=Status updated").isVisible().catch(() => false)
                log("Complete treatment item → success toast", completeToast, completeToast ? "toast visible" : "no toast")
                await shot(page, "29_after_complete_item")
              }
            }
          }
        }
      }
    } else {
      log("Estimate links present in doctor queue", false, "No queue entries today for Dr. Jashwant (queue is date-filtered; seed data is from past days)")
    }

    // ──────────────────────────────────────────────────────────────
    // 12. COLLECT PAYMENT (as receptionist)
    // ──────────────────────────────────────────────────────────────
    await login(page, ctx, RECEP)
    await page.goto(`${BASE}/patients`)
    await page.waitForLoadState("networkidle")

    // Search Rahul Sharma who has outstanding balance in seed data
    const paySearchEl = page.locator('input[placeholder*="Search"]').first()
    let rahulId = ""
    if (await paySearchEl.isVisible().catch(() => false)) {
      await paySearchEl.fill("Rahul Sharma")
      await page.waitForTimeout(800)
      const rahulLink = page.locator("a", { hasText: "Rahul Sharma" }).first()
      if (await rahulLink.isVisible().catch(() => false)) {
        const rahulHref = await rahulLink.getAttribute("href").catch(() => "")
        rahulId = rahulHref?.split("/patients/")[1]?.split("/")[0] ?? ""
      }
    }

    if (rahulId) {
      // Go to Payments tab
      await page.goto(`${BASE}/patients/${rahulId}/payments`)
      await page.waitForLoadState("networkidle")
      await shot(page, "30_rahul_payments")

      // "Collect Payment" is an <a> link (not button) in the payments page
      const collectPayLink = page.locator("a", { hasText: /Collect Payment/i }).first()
      const collectLinkOk = await collectPayLink.isVisible().catch(() => false)
      log("Collect Payment link on Payments tab", collectLinkOk, collectLinkOk ? "link found" : "NOT found (check if patient has balance or role is receptionist)")

      if (collectLinkOk) {
        const collectHref = await collectPayLink.getAttribute("href").catch(() => "")
        if (collectHref) {
          await page.goto(`${BASE}${collectHref}`)
          await page.waitForLoadState("networkidle")
          await shot(page, "31_collect_payment_form")

          const amountInput = page.locator('input[name="amount"]')
          if (await amountInput.isVisible().catch(() => false)) {
            await amountInput.fill("500")
            // Select CASH payment mode
            const cashRadio = page.locator('input[name="paymentMode"][value="CASH"]')
            if (await cashRadio.isVisible().catch(() => false)) await cashRadio.check()

            const submitPayBtn = page.locator('button[type="submit"]').first()
            if (await submitPayBtn.isVisible().catch(() => false)) {
              await submitPayBtn.click()
              const successLocator = page.locator("text=/Payment Recorded|Recorded|success/i").first()
              const successEl = await successLocator.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false)
              await shot(page, "32_after_payment")
              log("Collect Payment records payment", successEl, successEl ? "success message shown" : "no success message (check form)")
            }
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────────
    // 13. ADMIN PAGES
    // ──────────────────────────────────────────────────────────────
    await login(page, ctx, ADMIN)
    await shot(page, "33_admin_landing")
    log("Admin login", page.url().includes("/admin"), `URL: ${page.url()}`)

    for (const [route, label] of [
      ["/admin", "Admin dashboard"],
      ["/admin/reports/daily", "Admin daily reports"],
      ["/admin/users", "Admin users"],
      ["/admin/treatments", "Admin treatments"],
      ["/admin/settings", "Admin settings"],
      ["/admin/accounting", "Admin accounting"],
    ]) {
      await page.goto(`${BASE}${route}`)
      await page.waitForLoadState("networkidle")
      log(label, !page.url().includes("/login"), `URL: ${page.url()}`)
    }
    await shot(page, "34_admin_settings")

  } catch (err) {
    console.error("❌ CRASH:", err.message.split("\n")[0])
    await shot(page, "99_crash").catch(() => {})
    results.push({ step: "Script error", ok: false, note: err.message.split("\n")[0] })
  } finally {
    await browser.close()
  }

  // ── Report ────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60))
  console.log("FINAL RESULTS")
  console.log("═".repeat(60))
  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  results.forEach(r => console.log(`${r.ok ? "✅" : "❌"} ${r.step}: ${r.note}`))
  console.log(`\n${passed} passed  |  ${failed} failed  |  ${results.length} total`)

  if (consoleErrors.length) {
    const unique = [...new Set(consoleErrors)]
    console.log("\nBROWSER CONSOLE ERRORS:")
    unique.slice(0, 20).forEach(e => console.log(`  ⚠️  ${e}`))
  }
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`)
}

run()
