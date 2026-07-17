// Seeds 10 patients with PAYMENT_PENDING consultation queue entries
const { PrismaClient } = require("@prisma/client")
const { randomUUID } = require("crypto")

const prisma = new PrismaClient()

const BRANCH_OUTRAM   = "branch-outram-0000-0000-000000000001"
const BRANCH_ALIPORE  = "branch-alipo-0000-0000-000000000002"
const BRANCH_SALTLAKE = "branch-saltl-0000-0000-000000000003"
const DR_JASHWANT     = "user-drjas-00000-0000-000000000002"
const DR_CHETNA       = "user-drche-00000-0000-000000000003"
const DR_DISHA        = "user-drdis-00000-0000-000000000004"
const REC_OUTRAM      = "user-recou-00000-0000-000000000005"

// No doctor assigned — patients pay consultation fee first, then receptionist sends to doctor
const patients = [
  { name: "Sanjay Mehta",       mobile: "9831001001", gender: "MALE",   dob: "1985-03-15", branch: BRANCH_OUTRAM   },
  { name: "Rekha Pillai",       mobile: "9831001002", gender: "FEMALE", dob: "1990-07-22", branch: BRANCH_OUTRAM   },
  { name: "Arjun Nambiar",      mobile: "9831001003", gender: "MALE",   dob: "1978-11-08", branch: BRANCH_ALIPORE  },
  { name: "Divya Krishnan",     mobile: "9831001004", gender: "FEMALE", dob: "1995-02-14", branch: BRANCH_ALIPORE  },
  { name: "Tushar Banerjee",    mobile: "9831001005", gender: "MALE",   dob: "1982-09-30", branch: BRANCH_SALTLAKE },
  { name: "Pooja Chatterjee",   mobile: "9831001006", gender: "FEMALE", dob: "1992-05-19", branch: BRANCH_OUTRAM   },
  { name: "Vikram Malhotra",    mobile: "9831001007", gender: "MALE",   dob: "1975-12-03", branch: BRANCH_SALTLAKE },
  { name: "Meenakshi Rao",      mobile: "9831001008", gender: "FEMALE", dob: "1988-08-25", branch: BRANCH_ALIPORE  },
  { name: "Gaurav Srivastava",  mobile: "9831001009", gender: "MALE",   dob: "1993-04-11", branch: BRANCH_OUTRAM   },
  { name: "Asha Iyer",          mobile: "9831001010", gender: "FEMALE", dob: "1980-01-28", branch: BRANCH_SALTLAKE },
]

async function main() {
  // Get current max patient sequence number
  const last = await prisma.patient.findFirst({ orderBy: { patientId: "desc" }, select: { patientId: true } })
  let seq = last ? parseInt(last.patientId.split("-")[2]) + 1 : 12

  for (const p of patients) {
    const patientId = `PAT-2026-${String(seq++).padStart(5, "0")}`
    const visitSeq = String(seq).padStart(5, "0")

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        id: randomUUID(),
        patientId,
        fullName: p.name,
        mobile: p.mobile,
        gender: p.gender,
        dateOfBirth: new Date(p.dob),
        registrationBranchId: p.branch,
        createdById: REC_OUTRAM,
        reasonForVisit: "Dental consultation",
      },
    })

    // Create visit — no doctor yet, consultation fee not paid
    const visitNo = `VISIT-2026-${visitSeq}`
    const visit = await prisma.patientVisit.create({
      data: {
        id: randomUUID(),
        visitNo,
        patientId: patient.id,
        branchId: p.branch,
        visitType: "CONSULTATION",
        status: "IN_PROGRESS",
        chiefComplaint: "Toothache / routine check-up",
        createdById: REC_OUTRAM,
      },
    })

    // Create queue entry — WAITING, no doctor assigned yet
    // Consultation fee must be paid before receptionist sends patient to doctor
    await prisma.queueEntry.create({
      data: {
        id: randomUUID(),
        visitId: visit.id,
        patientId: patient.id,
        branchId: p.branch,
        tokenNumber: seq,
        status: "WAITING",
        sentAt: new Date(),
        createdById: REC_OUTRAM,
      },
    })

    const branchLabel = p.branch === BRANCH_OUTRAM ? "Outram" : p.branch === BRANCH_ALIPORE ? "New Alipore" : "Salt Lake"
    console.log(`✓ ${patientId} — ${p.name} [${branchLabel}] WAITING (no doctor, pending consultation payment)`)
  }

  console.log("\nDone — 10 patients added with PAYMENT_PENDING consultation queue status.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
