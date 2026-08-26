/**
 * Checks the appointment booking rules.
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '
')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only  *     -r tsconfig-paths/register qa/check-appointment-rules.ts
 *
 * Two rules with teeth: at most two bookings per patient per day (a third is
 * nearly always a double entry) with no limit across different days, and a
 * backdated entry recorded because reception forgot at the time, which must
 * land finished rather than reappearing in the queue as something still to do.
 *
 * Books far-future slots and removes them; safe to re-run.
 */
import { prisma } from "@/lib/prisma"
import { appointmentService } from "@/server/services/appointment.service"

let failures = 0
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++ }

async function main() {
  const branch = await prisma.branch.findFirstOrThrow({ select: { id: true } })
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR", isActive: true }, select: { id: true } })
  const patient = await prisma.patient.findFirstOrThrow({ where: { isDeleted: false }, select: { id: true } })
  const made: string[] = []
  const at = (days: number, h: number, m: number) => {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d
  }
  try {
    const a = await appointmentService.create(
      { patientId: patient.id, doctorId: doctor.id, branchId: branch.id, scheduledAt: at(400, 10, 15), durationMins: 15 },
      doctor.id)
    made.push(a.id)
    check(a.durationMins === 15, "a 15-minute slot books")
    check(a.status === "SCHEDULED", "a future booking is SCHEDULED")

    // Two a day is fine — morning and afternoon.
    const b = await appointmentService.create(
      { patientId: patient.id, doctorId: doctor.id, branchId: branch.id, scheduledAt: at(400, 15, 30) },
      doctor.id)
    made.push(b.id)
    check(true, "a second appointment the same day is allowed")

    let blocked = false
    try {
      const third = await appointmentService.create(
        { patientId: patient.id, doctorId: doctor.id, branchId: branch.id, scheduledAt: at(400, 17, 0) },
        doctor.id)
      made.push(third.id)
    } catch { blocked = true }
    check(blocked, "a third the same day is refused")

    const c = await appointmentService.create(
      { patientId: patient.id, doctorId: doctor.id, branchId: branch.id, scheduledAt: at(401, 10, 45) },
      doctor.id)
    made.push(c.id)
    check(true, "the same patient books freely on a different day")

    let pastBlocked = false
    try {
      const d = await appointmentService.create(
        { patientId: patient.id, doctorId: doctor.id, branchId: branch.id, scheduledAt: at(-30, 11, 0) },
        doctor.id)
      made.push(d.id)
    } catch { pastBlocked = true }
    check(pastBlocked, "a past date is refused without allowBackdated")

    const e = await appointmentService.create(
      { patientId: patient.id, doctorId: doctor.id, branchId: branch.id, scheduledAt: at(-30, 11, 0), allowBackdated: true },
      doctor.id)
    made.push(e.id)
    check(e.status === "COMPLETED", "a backdated entry lands COMPLETED, not sitting in the queue")
  } finally {
    if (made.length) await prisma.appointment.deleteMany({ where: { id: { in: made } } })
  }
  console.log(failures === 0 ? "\nall appointment-rule checks passed" : `\n${failures} FAILED`)
  process.exitCode = failures ? 1 : 0
}
main().finally(() => prisma.$disconnect())
