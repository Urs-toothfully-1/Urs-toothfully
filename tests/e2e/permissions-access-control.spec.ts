import { test, expect, type Page } from "@playwright/test"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { queueService } from "@/server/services/queue.service"
import { keysForRole, type PermissionKey } from "@/lib/permissions"

/**
 * Every access switch, one at a time (Admin → Users → Access). For each switch
 * the user gets everything EXCEPT that one, and the test checks it is blocked;
 * then everything ON, and checks it works. Permissions are read from the
 * database on every request, so one login per test is enough.
 *
 * LOCAL database only: seeds a test doctor, a test receptionist and two patients.
 */

const OUTRAM = "branch-outram-0000-0000-000000000001"
const PASSWORD = "E2eMatrix@123"
const stamp = Date.now().toString().slice(-6)
const DOC = { email: "e2e.matrix.doc@toothfully.in", name: "Dr E2E Matrix" }
const DESK = { email: "e2e.matrix.desk@toothfully.in", name: "E2E Matrix Desk" }
const ids = { doc: "", desk: "", today: "", other: "", txQueue: "", queued: "", waiting: "", waitingQueue: "" }
const names = { today: `E2E Matrix Today ${stamp}`, other: `E2E Matrix Other ${stamp}` }

test.describe.configure({ mode: "serial" })

const setPerms = (userId: string, off: PermissionKey[]) =>
  prisma.user.update({
    where: { id: userId },
    data: { permissions: Object.fromEntries(off.map((k) => [k, false])) },
  })
// Prisma.DbNull clears the JSON column (= full access for the role).
const allOn = async (userId: string) => {
  await prisma.user.update({ where: { id: userId }, data: { permissions: Prisma.DbNull } })
}

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const upsert = (email: string, name: string, role: "DOCTOR" | "RECEPTIONIST") =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, role, branchId: OUTRAM, passwordHash },
      update: {
        passwordHash,
        isActive: true,
        loginAttempts: 0,
        lockedUntil: null,
        permissions: Prisma.DbNull,
      },
    })
  ids.doc = (await upsert(DOC.email, DOC.name, "DOCTOR")).id
  ids.desk = (await upsert(DESK.email, DESK.name, "RECEPTIONIST")).id

  const reception = await prisma.user.findFirstOrThrow({
    where: { email: "reception.outram@toothfully.in" },
  })
  const mk = (fullName: string, mobile: string) =>
    patientService.createWithHistory(
      {
        registrationBranchId: OUTRAM,
        fullName,
        dateOfBirth: "1990-01-01",
        gender: "FEMALE",
        mobile,
        email: `mx${mobile}@example.com`,
        address: "E2E",
        leadSource: "",
        referenceName: "",
        reasonForVisit: "",
      } as any,
      { consentGiven: true } as any,
      reception.id
    )
  ids.today = (await mk(names.today, `91${stamp}81`)).id
  ids.other = (await mk(names.other, `91${stamp}82`)).id

  // "Today's patient" for both test users: a late appointment today with the test doctor.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  await prisma.appointment.create({
    data: {
      patientId: ids.today,
      doctorId: ids.doc,
      branchId: OUTRAM,
      scheduledAt: new Date(`${today}T23:${String(Number(stamp) % 50).padStart(2, "0")}:00+05:30`),
      reason: "E2E matrix",
      createdById: reception.id,
    },
  })
  // A queue entry at Outram for the reception queue switch — a third patient and a
  // regular doctor, so it doesn't put "today" or "other" in anyone's scope.
  const queued = (await mk(`E2E Matrix Queued ${stamp}`, `91${stamp}83`)).id
  const regularDoctor = await prisma.user.findFirstOrThrow({
    where: { email: "dr.jashwant@toothfully.in" },
  })
  ids.txQueue = (
    await queueService.addToQueue(
      {
        patientId: queued,
        branchId: OUTRAM,
        visitType: "CONSULTATION",
        chiefComplaint: "E2E matrix",
        doctorId: regularDoctor.id,
      } as any,
      reception.id
    )
  ).queueEntry.id
  ids.queued = queued

  // Waiting in Outram's queue with no doctor yet — any doctor there may pick it up.
  ids.waiting = (await mk(`E2E Matrix Waiting ${stamp}`, `91${stamp}84`)).id
  const w = await queueService.addToQueue(
    { patientId: ids.waiting, branchId: OUTRAM, visitType: "CONSULTATION", chiefComplaint: "E2E matrix", doctorId: regularDoctor.id } as any,
    reception.id
  )
  ids.waitingQueue = w.queueEntry.id
  await prisma.queueEntry.update({ where: { id: w.queueEntry.id }, data: { doctorId: null } })
})

test.afterAll(async () => {
  await prisma.user.updateMany({
    where: { email: { in: [DOC.email, DESK.email] } },
    data: { isActive: false },
  })
  await prisma.queueEntry.updateMany({
    where: { id: { in: [ids.txQueue, ids.waitingQueue] }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    data: { status: "CANCELLED" },
  })
  await prisma.$disconnect()
})

async function loginAs(page: Page, email: string) {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.getByRole("button", { name: /sign in/i }).click(),
  ])
}
const notFound = (page: Page) => expect(page.getByText("Page Not Found")).toBeVisible()
const found = (page: Page) => expect(page.getByText("Page Not Found")).toHaveCount(0)
const status = async (page: Page, url: string, method: "GET" | "PATCH" = "GET", data?: object) =>
  (method === "GET"
    ? await page.request.get(url)
    : await page.request.patch(url, { data })
  ).status()

type Check = { off: (page: Page) => Promise<void>; on: (page: Page) => Promise<void> }

// ─── Doctor ──────────────────────────────────────────────────────────────────

const doctorChecks: Record<string, Check> = {
  allPatients: {
    off: async (page) => {
      await page.goto(`/patients/${ids.other}`)
      await notFound(page)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.other}`)
      await expect(page.getByText(names.other).first()).toBeVisible()
    },
  },
  prices: {
    off: async (page) => {
      const { treatments } = await (await page.request.get("/api/treatments")).json()
      expect(
        treatments.every((t: { defaultAmount: unknown }) => Number(t.defaultAmount) === 0)
      ).toBe(true)
    },
    on: async (page) => {
      const { treatments } = await (await page.request.get("/api/treatments")).json()
      expect(treatments.some((t: { defaultAmount: unknown }) => Number(t.defaultAmount) > 0)).toBe(
        true
      )
    },
  },
  payments: {
    off: async (page) => {
      expect(await status(page, `/api/payments?patientId=${ids.today}`)).toBeGreaterThanOrEqual(401)
      await page.goto(`/patients/${ids.today}/payments`)
      await notFound(page)
    },
    on: async (page) => {
      expect(await status(page, `/api/payments?patientId=${ids.today}`)).toBe(200)
      await page.goto(`/patients/${ids.today}/payments`)
      await found(page)
    },
  },
  // "Create and edit" — viewing is "See prices". An empty body: 401 when blocked,
  // 400 (validation) when allowed through, so nothing is actually created.
  estimates: {
    off: async (page) => {
      expect((await page.request.post("/api/estimates", { data: {} })).status()).toBe(401)
    },
    on: async (page) => {
      expect((await page.request.post("/api/estimates", { data: {} })).status()).toBe(400)
    },
  },
  prescriptions: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByText(names.today).first()).toBeVisible()
      await expect(page.getByRole("button", { name: /New prescription/ })).toHaveCount(0)
    },
    // The reported bug: a doctor with "Write prescriptions" must be able to create one.
    on: async (page) => {
      await page.goto(`/patients/${ids.today}`, { waitUntil: "networkidle" })
      await page.getByRole("button", { name: /New prescription/ }).click()
      await expect(page.getByLabel("Doctor")).toHaveValue(ids.doc) // herself, preselected
      await page.getByRole("button", { name: "Start" }).click()
      await expect(page).toHaveURL(/\/doctor\/consultation\//)
      await page.getByPlaceholder(/Type the complaint/).fill("Matrix check")
      await page.getByRole("button", { name: "Save Prescription" }).click()
      await expect
        .poll(() =>
          prisma.prescriptionRecord.count({
            where: { patientId: ids.today, visit: { doctorId: ids.doc } },
          })
        )
        .toBeGreaterThan(0)
    },
  },
  clinicalNotes: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}/notes`)
      await expect(page.getByText("Access Restricted")).toBeVisible()
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.today}/notes`)
      await expect(page.getByText(names.today).first()).toBeVisible()
      await expect(page.getByText("Access Restricted")).toHaveCount(0)
    },
  },
  documents: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}/documents`)
      await notFound(page)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.today}/documents`)
      await found(page)
      await expect(page.getByText(names.today).first()).toBeVisible()
    },
  },
  appointments: {
    off: async (page) => {
      await page.goto("/appointments")
      await expect(page).toHaveURL(/\/doctor$/)
    },
    on: async (page) => {
      await page.goto("/appointments")
      await expect(page).toHaveURL(/\/appointments/)
    },
  },
}

// ─── Receptionist ────────────────────────────────────────────────────────────

const deskChecks: Record<string, Check> = {
  allPatients: {
    off: async (page) => {
      await page.goto(`/patients/${ids.other}`)
      await notFound(page)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.other}`)
      await expect(page.getByText(names.other).first()).toBeVisible()
    },
  },
  prices: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByText(names.today).first()).toBeVisible()
      await expect(page.getByText("Balance", { exact: true })).toHaveCount(0)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByText("Balance", { exact: true })).toBeVisible()
    },
  },
  payments: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}/payments`)
      await notFound(page)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.today}/payments`)
      await found(page)
    },
  },
  documents: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}/documents`)
      await notFound(page)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.today}/documents`)
      await found(page)
    },
  },
  editPatients: {
    off: async (page) => {
      await page.goto("/patients/new")
      await expect(page).toHaveURL(/\/patients$/)
    },
    on: async (page) => {
      await page.goto("/patients/new")
      await expect(page).toHaveURL(/\/patients\/new/)
    },
  },
  collectPayments: {
    off: async (page) => {
      await page.goto(`/reception/collect-payment?patientId=${ids.today}`)
      await expect(page).toHaveURL(/\/reception$/)
    },
    on: async (page) => {
      await page.goto(`/reception/collect-payment?patientId=${ids.today}`)
      await expect(page).toHaveURL(/collect-payment/)
    },
  },
  directClinical: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByText(names.today).first()).toBeVisible()
      await expect(page.getByRole("button", { name: /New prescription/ })).toHaveCount(0)
    },
    on: async (page) => {
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByRole("button", { name: /New prescription/ })).toBeVisible()
    },
  },
  queue: {
    off: async (page) => {
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByText(names.today).first()).toBeVisible()
      await expect(page.getByText(/Add to Doctor Queue/)).toHaveCount(0)
      expect(
        await status(page, `/api/queue/${ids.txQueue}`, "PATCH", { status: "PAYMENT_PENDING" })
      ).toBe(403)
    },
    on: async (page) => {
      // Fee first, then the queue step — both shown when the switch is on.
      await page.goto(`/patients/${ids.today}`)
      await expect(page.getByText(/Add to Doctor Queue/)).toBeVisible()
      expect(
        await status(page, `/api/queue/${ids.txQueue}`, "PATCH", { status: "PAYMENT_PENDING" })
      ).toBe(200)
    },
  },
  appointments: {
    off: async (page) => {
      await page.goto("/appointments")
      await expect(page).toHaveURL(/\/reception$/)
    },
    on: async (page) => {
      await page.goto("/appointments")
      await expect(page).toHaveURL(/\/appointments/)
    },
  },
  whatsapp: {
    off: async (page) => {
      await page.goto("/whatsapp/inbox")
      await expect(page).toHaveURL(/\/reception$/)
    },
    on: async (page) => {
      await page.goto("/whatsapp/inbox")
      await expect(page).toHaveURL(/\/whatsapp\/inbox/)
    },
  },
}

test("the test grid covers every switch for both roles", () => {
  expect(keysForRole("DOCTOR").sort()).toEqual(Object.keys(doctorChecks).sort())
  expect(keysForRole("RECEPTIONIST").sort()).toEqual(Object.keys(deskChecks).sort())
})

test.describe("Doctor — each switch", () => {
  test.beforeEach(async ({ page }) => loginAs(page, DOC.email))
  for (const [key, check] of Object.entries(doctorChecks)) {
    test(`${key}: off blocks, on allows`, async ({ page }) => {
      await setPerms(ids.doc, [key as PermissionKey])
      await check.off(page)
      await allOn(ids.doc)
      await check.on(page)
    })
  }

  test("Dr. Yamini's exact settings can still create a prescription from the profile", async ({
    page,
  }) => {
    await setPerms(ids.doc, ["prices", "payments", "documents", "estimates", "allPatients"])
    await doctorChecks.prescriptions.on(page)
    await allOn(ids.doc)
  })

  test("today's-patients doctor also sees the unassigned queue, not other doctors' patients", async ({ page }) => {
    await setPerms(ids.doc, ["allPatients"])
    await page.goto(`/patients/${ids.waiting}`)
    await expect(page.getByText(`E2E Matrix Waiting ${stamp}`).first()).toBeVisible()
    await page.goto(`/patients/${ids.queued}`) // queued for another doctor
    await notFound(page)
    await allOn(ids.doc)
  })
})

test.describe("Receptionist — each switch", () => {
  test.beforeEach(async ({ page }) => loginAs(page, DESK.email))
  for (const [key, check] of Object.entries(deskChecks)) {
    test(`${key}: off blocks, on allows`, async ({ page }) => {
      await setPerms(ids.desk, [key as PermissionKey])
      await check.off(page)
      await allOn(ids.desk)
      await check.on(page)
    })
  }
})
