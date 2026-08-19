import { PrismaClient, Role, Gender } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const BCRYPT_COST = 12

async function main() {
  console.log("🌱 Seeding database...")

  // ── Branches ────────────────────────────────────────────────
  const outram = await prisma.branch.upsert({
    where: { id: "branch-outram-0000-0000-000000000001" },
    update: {},
    create: {
      id: "branch-outram-0000-0000-000000000001",
      name: "Outram",
      address: "1B Outram Street, Kolkata – 700 017",
      phone: "+91 90380 05505 / 033 4803 0792",
      isActive: true,
    },
  })

  const newAlipore = await prisma.branch.upsert({
    where: { id: "branch-alipo-0000-0000-000000000002" },
    update: {},
    create: {
      id: "branch-alipo-0000-0000-000000000002",
      name: "New Alipore",
      address: "643B, Block-O, New Alipore, Kolkata – 700 053",
      phone: "+91 33796 15277 / +91 97480 38280",
      isActive: true,
    },
  })

  const saltLake = await prisma.branch.upsert({
    where: { id: "branch-saltl-0000-0000-000000000003" },
    update: {},
    create: {
      id: "branch-saltl-0000-0000-000000000003",
      name: "Salt Lake",
      address: "AL16, Near 8 No. Water Tank, Sector II, Bidhannagar, Kolkata – 700 091",
      phone: "+91 78900 08331 / +91 97480 38280",
      isActive: true,
    },
  })

  console.log("✅ Branches created")

  // ── Admin ────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin@123", BCRYPT_COST)
  const admin = await prisma.user.upsert({
    where: { email: "admin@toothfully.in" },
    update: {},
    create: {
      id: "user-admin-00000-0000-000000000001",
      branchId: outram.id,
      name: "System Admin",
      email: "admin@toothfully.in",
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
  })

  // ── Doctors ──────────────────────────────────────────────────
  const doctorHash = await bcrypt.hash("Doctor@123", BCRYPT_COST)

  const drJashwant = await prisma.user.upsert({
    where: { email: "dr.jashwant@toothfully.in" },
    update: {},
    create: {
      id: "user-drjas-00000-0000-000000000002",
      branchId: outram.id,
      name: "Dr. Jashwant Kr. Sinha",
      email: "dr.jashwant@toothfully.in",
      passwordHash: doctorHash,
      role: Role.DOCTOR,
      doctorRegNo: "3079A",
      doctorQualification: "BDS (Chennai) — Oral Implantologist, Diplomate in Aesthetic Dentistry",
      isActive: true,
    },
  })

  const drChetna = await prisma.user.upsert({
    where: { email: "dr.chetna@toothfully.in" },
    update: {},
    create: {
      id: "user-drche-00000-0000-000000000003",
      branchId: newAlipore.id,
      name: "Dr. Chetna Tikmani",
      email: "dr.chetna@toothfully.in",
      passwordHash: doctorHash,
      role: Role.DOCTOR,
      doctorRegNo: "2885/A",
      doctorQualification:
        "BDS, MDS (RADCH, KOL) — Prosthodontist & Implantologist, Ex-house Surgeon (Govt. Dental College, WB)",
      isActive: true,
    },
  })

  const drDisha = await prisma.user.upsert({
    where: { email: "dr.disha@toothfully.in" },
    update: {},
    create: {
      id: "user-drdis-00000-0000-000000000004",
      branchId: saltLake.id,
      name: "Dr. Disha Agarwal",
      email: "dr.disha@toothfully.in",
      passwordHash: doctorHash,
      role: Role.DOCTOR,
      doctorRegNo: "45025A",
      doctorQualification: "BDS — General Dentist",
      isActive: true,
    },
  })

  // ── Receptionists ────────────────────────────────────────────
  const recHash = await bcrypt.hash("Reception@123", BCRYPT_COST)

  await prisma.user.upsert({
    where: { email: "reception.outram@toothfully.in" },
    update: {},
    create: {
      id: "user-recou-00000-0000-000000000005",
      branchId: outram.id,
      name: "Outram Reception",
      email: "reception.outram@toothfully.in",
      passwordHash: recHash,
      role: Role.RECEPTIONIST,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: "reception.alipore@toothfully.in" },
    update: {},
    create: {
      id: "user-recal-00000-0000-000000000006",
      branchId: newAlipore.id,
      name: "New Alipore Reception",
      email: "reception.alipore@toothfully.in",
      passwordHash: recHash,
      role: Role.RECEPTIONIST,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: "reception.saltlake@toothfully.in" },
    update: {},
    create: {
      id: "user-recsl-00000-0000-000000000007",
      branchId: saltLake.id,
      name: "Salt Lake Reception",
      email: "reception.saltlake@toothfully.in",
      passwordHash: recHash,
      role: Role.RECEPTIONIST,
      isActive: true,
    },
  })

  console.log("✅ Users created")

  // ── Doctor Availability ──────────────────────────────────────
  // Mon–Sat, Thursday off → MON,TUE,WED,FRI,SAT
  const workingDays = "MON,TUE,WED,FRI,SAT"

  const availabilityData = [
    { doctorId: drJashwant.id, branchId: outram.id, suffix: "jas-out" },
    { doctorId: drJashwant.id, branchId: newAlipore.id, suffix: "jas-ali" },
    { doctorId: drJashwant.id, branchId: saltLake.id, suffix: "jas-sal" },
    { doctorId: drChetna.id, branchId: outram.id, suffix: "che-out" },
    { doctorId: drChetna.id, branchId: newAlipore.id, suffix: "che-ali" },
    { doctorId: drChetna.id, branchId: saltLake.id, suffix: "che-sal" },
    { doctorId: drDisha.id, branchId: outram.id, suffix: "dis-out" },
    { doctorId: drDisha.id, branchId: newAlipore.id, suffix: "dis-ali" },
    { doctorId: drDisha.id, branchId: saltLake.id, suffix: "dis-sal" },
  ]

  for (const av of availabilityData) {
    await prisma.doctorAvailability.upsert({
      where: {
        doctor_branch_availability: {
          doctorId: av.doctorId,
          branchId: av.branchId,
        },
      },
      update: {},
      create: {
        doctorId: av.doctorId,
        branchId: av.branchId,
        workingDays,
        startTime: "10:30",
        endTime: "20:30",
        isActive: true,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
  }

  // Sunday availability (shorter hours)
  // Note: Sunday availability handled separately if needed — skip for now

  console.log("✅ Doctor availability created")

  // ── Treatment Master ─────────────────────────────────────────
  const treatments = [
    // ENDODONTICS
    { category: "ENDODONTICS", name: "Root Canal Treatment (Single Canal)", amount: 3500 },
    { category: "ENDODONTICS", name: "Root Canal Treatment (Multi Canal)", amount: 5500 },
    { category: "ENDODONTICS", name: "Re-Root Canal Treatment", amount: 6500 },
    { category: "ENDODONTICS", name: "Pulpotomy", amount: 1500 },
    { category: "ENDODONTICS", name: "Apicectomy", amount: 4500 },

    // PROSTHODONTICS
    { category: "PROSTHODONTICS", name: "Metal Crown", amount: 2500 },
    { category: "PROSTHODONTICS", name: "PFM Crown (Porcelain Fused to Metal)", amount: 4500 },
    { category: "PROSTHODONTICS", name: "Zirconia Crown", amount: 8000 },
    { category: "PROSTHODONTICS", name: "E-Max Crown", amount: 9000 },
    { category: "PROSTHODONTICS", name: "Dental Bridge (per unit)", amount: 4500 },
    { category: "PROSTHODONTICS", name: "Complete Denture (per jaw)", amount: 12000 },
    { category: "PROSTHODONTICS", name: "Partial Denture", amount: 8000 },
    { category: "PROSTHODONTICS", name: "Flexible Denture", amount: 15000 },

    // ORAL SURGERY
    { category: "ORAL SURGERY", name: "Simple Extraction", amount: 800 },
    { category: "ORAL SURGERY", name: "Surgical Extraction", amount: 2500 },
    { category: "ORAL SURGERY", name: "Wisdom Tooth Removal (Simple)", amount: 2000 },
    { category: "ORAL SURGERY", name: "Wisdom Tooth Removal (Surgical)", amount: 5000 },
    { category: "ORAL SURGERY", name: "Cyst Removal", amount: 6000 },

    // PERIODONTICS
    { category: "PERIODONTICS", name: "Scaling & Polishing", amount: 1500 },
    { category: "PERIODONTICS", name: "Deep Scaling (per quadrant)", amount: 1200 },
    { category: "PERIODONTICS", name: "Flap Surgery (per quadrant)", amount: 6000 },
    { category: "PERIODONTICS", name: "Gum Depigmentation", amount: 5000 },
    { category: "PERIODONTICS", name: "Gingivectomy", amount: 3500 },

    // ORTHODONTICS
    { category: "ORTHODONTICS", name: "Metal Braces (full)", amount: 25000 },
    { category: "ORTHODONTICS", name: "Ceramic Braces (full)", amount: 35000 },
    { category: "ORTHODONTICS", name: "Clear Aligners", amount: 60000 },
    { category: "ORTHODONTICS", name: "Retainer", amount: 3000 },

    // PEDODONTICS
    { category: "PEDODONTICS", name: "Fluoride Application", amount: 800 },
    { category: "PEDODONTICS", name: "Pit & Fissure Sealant (per tooth)", amount: 600 },
    { category: "PEDODONTICS", name: "Milk Tooth Extraction", amount: 500 },
    { category: "PEDODONTICS", name: "Space Maintainer", amount: 3500 },
    { category: "PEDODONTICS", name: "Pulpectomy (Milk Tooth)", amount: 1800 },

    // COSMETIC DENTISTRY
    { category: "COSMETIC DENTISTRY", name: "Tooth Whitening / Bleaching", amount: 8000 },
    { category: "COSMETIC DENTISTRY", name: "Composite Bonding (per tooth)", amount: 2000 },
    { category: "COSMETIC DENTISTRY", name: "Porcelain Veneer (per tooth)", amount: 9000 },
    { category: "COSMETIC DENTISTRY", name: "Composite Veneer (per tooth)", amount: 3500 },
    { category: "COSMETIC DENTISTRY", name: "Smile Makeover (consultation)", amount: 500 },

    // ORAL MEDICINE & RADIOLOGY
    { category: "ORAL MEDICINE & RADIOLOGY", name: "IOPA X-Ray", amount: 200 },
    { category: "ORAL MEDICINE & RADIOLOGY", name: "OPG (Panoramic X-Ray)", amount: 800 },
    { category: "ORAL MEDICINE & RADIOLOGY", name: "CBCT Scan", amount: 3500 },
    { category: "ORAL MEDICINE & RADIOLOGY", name: "Ulcer Treatment", amount: 500 },

    // IMPLANTOLOGY
    { category: "IMPLANTOLOGY", name: "Dental Implant (single tooth)", amount: 25000 },
    { category: "IMPLANTOLOGY", name: "Implant Crown", amount: 8000 },
    { category: "IMPLANTOLOGY", name: "Bone Grafting", amount: 12000 },
    { category: "IMPLANTOLOGY", name: "Sinus Lift", amount: 18000 },
    { category: "IMPLANTOLOGY", name: "All-on-4 Implants (per jaw)", amount: 150000 },

    // PREVENTIVE DENTISTRY
    { category: "PREVENTIVE DENTISTRY", name: "Oral Hygiene Instructions", amount: 300 },
    { category: "PREVENTIVE DENTISTRY", name: "Dietary Counselling", amount: 300 },
    { category: "PREVENTIVE DENTISTRY", name: "Night Guard (Occlusal Splint)", amount: 5000 },
    { category: "PREVENTIVE DENTISTRY", name: "Mouthguard (Sports)", amount: 3500 },
  ]

  for (const t of treatments) {
    await prisma.treatmentMaster.upsert({
      where: {
        id: `treat-${t.category.toLowerCase().replace(/\s+&?\s*/g, "-").substring(0, 8)}-${t.name.toLowerCase().replace(/\s+/g, "-").substring(0, 20)}`.substring(0, 36),
      },
      update: {},
      create: {
        id: `treat-${t.category.toLowerCase().replace(/\s+&?\s*/g, "-").substring(0, 8)}-${t.name.toLowerCase().replace(/\s+/g, "-").substring(0, 20)}`.substring(0, 36),
        category: t.category,
        name: t.name,
        defaultAmount: t.amount,
        isActive: true,
        createdById: admin.id,
      },
    })
  }

  console.log("✅ Treatment master created")

  // ── System Settings ──────────────────────────────────────────
  // Global settings (branchId = null) — upsert not supported with null FK, use find+create
  const globalSettings = [
    { key: "advance_percent", value: "0" },
    { key: "allow_discount", value: "true" },
  ]

  for (const setting of globalSettings) {
    const existing = await prisma.systemSetting.findFirst({
      where: { branchId: null, key: setting.key },
    })
    if (!existing) {
      await prisma.systemSetting.create({
        data: { branchId: null, key: setting.key, value: setting.value, updatedById: admin.id },
      })
    }
  }

  // Per-branch settings
  const branchSettings = [outram, newAlipore, saltLake]
  for (const branch of branchSettings) {
    const perBranchSettings = [
      { key: "queue_assignment_mode", value: "SPECIFIC_DOCTOR" },
      { key: "consultation_fee", value: "500" },
      { key: "prescription_mode", value: "PRINT_ONLY" },
    ]
    for (const setting of perBranchSettings) {
      await prisma.systemSetting.upsert({
        where: { branchId_key: { branchId: branch.id, key: setting.key } },
        update: { value: setting.value },
        create: {
          branchId: branch.id,
          key: setting.key,
          value: setting.value,
          updatedById: admin.id,
        },
      })
    }
  }

  console.log("✅ System settings created")

  // ── Prescription Template ────────────────────────────────────
  await prisma.prescriptionTemplate.upsert({
    where: { id: "tmpl-default-000000000000000000001" },
    update: {},
    create: {
      id: "tmpl-default-000000000000000000001",
      branchId: null,
      name: "Default Prescription Template",
      mode: "PRINT_ONLY",
      headerImagePath: "/Header.jpg",
      footerImagePath: "/fotter-1.jpg",
      isActive: true,
      createdById: admin.id,
    },
  })

  console.log("✅ Prescription template created")

  // Seed demo patients
  await seedDemoPatients()

  console.log("\n🎉 Seed complete!")
  console.log("\n📋 Login credentials:")
  console.log("   Admin:        admin@toothfully.in       / Admin@123")
  console.log("   Doctor (x3):  dr.jashwant@toothfully.in / Doctor@123")
  console.log("                 dr.chetna@toothfully.in   / Doctor@123")
  console.log("                 dr.disha@toothfully.in    / Doctor@123")
  console.log("   Reception:    reception.outram@toothfully.in  / Reception@123")
  console.log("                 reception.alipore@toothfully.in / Reception@123")
  console.log("                 reception.saltlake@toothfully.in/ Reception@123")
  console.log("\n⚠️  Change all passwords immediately after first login!")
}

// ─── DEMO PATIENT DATA ─────────────────────────────────────────

async function seedDemoPatients() {
  const existing = await prisma.patient.count({ where: { isDeleted: false } })
  if (existing >= 5) {
    console.log("✅ Demo patients already exist, skipping")
    return
  }

  console.log("🌱 Seeding demo patients...")

  // Fixed seed IDs
  const ADMIN  = "user-admin-00000-0000-000000000001"
  const OUTRAM = "branch-outram-0000-0000-000000000001"
  const ALIPORE = "branch-alipo-0000-0000-000000000002"
  const SALTLAKE = "branch-saltl-0000-0000-000000000003"
  const DR_J  = "user-drjas-00000-0000-000000000002"
  const DR_C  = "user-drche-00000-0000-000000000003"
  const DR_D  = "user-drdis-00000-0000-000000000004"
  const REC_O = "user-recou-00000-0000-000000000005"
  const REC_A = "user-recal-00000-0000-000000000006"
  const REC_S = "user-recsl-00000-0000-000000000007"

  // ── Helpers ────────────────────────────────────────────────────
  const allTx = await prisma.treatmentMaster.findMany({ where: { isDeleted: false } })
  const tx = (name: string) => allTx.find((t) => t.name === name)

  async function payBundle(args: {
    paymentType: "CONSULTATION" | "TREATMENT" | "ADVANCE"
    estimateId?: string; visitId?: string; patientId: string; branchId: string
    amount: number; mode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER"
    collectedById: string; receiptNo: string; paymentDate: Date
  }) {
    if (await prisma.receipt.findFirst({ where: { receiptNo: args.receiptNo } })) return
    await prisma.$transaction(async (t) => {
      const p = await t.payment.create({ data: {
        paymentType: args.paymentType, estimateId: args.estimateId, visitId: args.visitId,
        patientId: args.patientId, branchId: args.branchId,
        amount: new Decimal(args.amount), mode: args.mode,
        paymentDate: args.paymentDate, collectedById: args.collectedById,
      }})
      await t.receipt.create({ data: {
        receiptNo: args.receiptNo, paymentId: p.id, patientId: args.patientId,
        branchId: args.branchId, issuedById: args.collectedById, issuedAt: args.paymentDate,
      }})
      await t.accountingEntry.create({ data: {
        paymentId: p.id, branchId: args.branchId, patientId: args.patientId,
        entryDate: args.paymentDate, amount: new Decimal(args.amount),
        paymentMode: args.mode, paymentType: args.paymentType, entryType: "RECEIPT", status: "APPROVED",
      }})
    })
  }

  async function makeEstimate(args: {
    no: string; patientId: string; branchId: string; doctorId: string; visitId: string
    items: Array<{ name: string; category: string; tooth?: string; qty: number; rate: number }>
    discount?: number; notes?: string; status?: string
  }) {
    if (await prisma.estimate.findFirst({ where: { estimateNo: args.no } })) {
      return (await prisma.estimate.findFirst({ where: { estimateNo: args.no } }))!
    }
    const subtotal = args.items.reduce((s, i) => s + i.qty * i.rate, 0)
    const discountAmt = args.discount ? (subtotal * args.discount) / 100 : 0
    const total = subtotal - discountAmt
    return prisma.estimate.create({
      data: {
        estimateNo: args.no, patientId: args.patientId, branchId: args.branchId,
        doctorId: args.doctorId, visitId: args.visitId,
        subtotal: new Decimal(subtotal),
        discountPercent: args.discount ? new Decimal(args.discount) : undefined,
        discountAmount: discountAmt > 0 ? new Decimal(discountAmt) : undefined,
        total: new Decimal(total), advanceRequired: new Decimal(total * 0.2),
        notes: args.notes, status: (args.status ?? "ACTIVE") as any,
        items: {
          create: args.items.map((i, idx) => ({
            treatmentId: tx(i.name)?.id,
            treatmentName: i.name, category: i.category,
            toothNumber: i.tooth, quantity: i.qty,
            unitRate: new Decimal(i.rate), amount: new Decimal(i.qty * i.rate),
            sortOrder: idx,
            status: args.status === "COMPLETED" ? "COMPLETED" as const : "PENDING" as const,
          }))
        }
      }
    })
  }

  async function makeVisit(args: {
    no: string; patientId: string; branchId: string; doctorId?: string
    type: string; date: Date; status: string; complaint?: string; createdBy: string
  }) {
    return prisma.patientVisit.upsert({
      where: { visitNo: args.no },
      update: {},
      create: {
        visitNo: args.no, patientId: args.patientId, branchId: args.branchId,
        doctorId: args.doctorId, visitType: args.type as any,
        visitDate: args.date, status: args.status as any,
        chiefComplaint: args.complaint, createdById: args.createdBy,
      }
    })
  }

  async function makeQueue(visitId: string, patientId: string, branchId: string, doctorId: string | undefined, token: number, status: string, sentAt: Date, completedAt?: Date, createdBy: string = REC_O) {
    if (await prisma.queueEntry.findFirst({ where: { visitId } })) return
    await prisma.queueEntry.create({ data: {
      visitId, patientId, branchId, doctorId: doctorId ?? undefined, tokenNumber: token,
      status: status as any, sentAt, calledAt: completedAt ? new Date(sentAt.getTime() + 30 * 60000) : undefined,
      completedAt, createdById: createdBy,
    }})
  }

  async function makeNote(patientId: string, visitId: string, doctorId: string, type: string, content: string) {
    if (await prisma.clinicalNote.findFirst({ where: { visitId, noteType: type } })) return
    await prisma.clinicalNote.create({ data: { patientId, visitId, doctorId, noteType: type, content } })
  }

  async function makeHistory(patientId: string, createdById: string, data: Record<string, unknown>) {
    if (await prisma.dentalHistory.findFirst({ where: { patientId, isLatest: true } })) return
    await prisma.dentalHistory.create({ data: {
      patientId, version: 1, isLatest: true, createdById,
      consentGiven: true, consentDate: new Date(),
      ...data
    }})
  }

  // ─────────────────────────────────────────────────────────────
  // PATIENT 1 — Amit Kumar · Outram · Diabetes + High BP
  // RCT + Zirconia Crown + Scaling — COMPLETED, fully paid
  // ─────────────────────────────────────────────────────────────
  const p1 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00001" }, update: {},
    create: {
      patientId: "PAT-2026-00001", registrationBranchId: OUTRAM,
      fullName: "Amit Kumar", dateOfBirth: new Date("1991-03-15"), gender: "MALE",
      mobile: "9876543210", email: "amit.kumar@gmail.com",
      address: "12, Rabindra Sarani, Kolkata - 700 006",
      leadSource: "Walk-in", reasonForVisit: "Severe toothache in lower right molar",
      createdById: REC_O,
    }
  })
  await makeHistory(p1.id, REC_O, {
    diabetes: true, bloodPressure: true, bloodPressureType: "HIGH",
    currentMedications: "Metformin 500mg BD, Amlodipine 5mg OD",
    generalHealthNotes: "Diabetic for 8 years, BP partially controlled.",
    foodCatching: true, sensitiveTeeth: true, lastDentistVisit: "2 years ago",
  })
  const v1 = await makeVisit({ no: "VISIT-2026-00001", patientId: p1.id, branchId: OUTRAM, doctorId: DR_J, type: "CONSULTATION", date: new Date("2026-06-20T10:30:00"), status: "COMPLETED", complaint: "Severe toothache tooth #46, hot/cold sensitivity", createdBy: REC_O })
  await makeQueue(v1.id, p1.id, OUTRAM, DR_J, 3, "COMPLETED", new Date("2026-06-20T10:30:00"), new Date("2026-06-20T12:30:00"))
  await makeNote(p1.id, v1.id, DR_J, "EXAMINATION", "Tooth #46 — periapical abscess confirmed on IOPA. Deep carious lesion reaching pulp. BP 148/92. Glucose 210 mg/dL. Pre-op antibiotics advised due to diabetic status.")
  await makeNote(p1.id, v1.id, DR_J, "TREATMENT_NOTE", "RCT completed single sitting — 3 canals, WL by IOPA, obturated with gutta percha. Temporary restoration placed. Zirconia crown prep done, impression taken. Full mouth scaling performed — moderate calculus removed supragingival.")
  const e1 = await makeEstimate({ no: "EST-2026-00001", patientId: p1.id, branchId: OUTRAM, doctorId: DR_J, visitId: v1.id, status: "COMPLETED", notes: "RCT + Zirconia Crown tooth #46 + Full Mouth Scaling", items: [
    { name: "Root Canal Treatment (Multi Canal)", category: "ENDODONTICS", tooth: "46", qty: 1, rate: 5500 },
    { name: "Zirconia Crown", category: "PROSTHODONTICS", tooth: "46", qty: 1, rate: 8000 },
    { name: "Scaling & Polishing", category: "PERIODONTICS", qty: 1, rate: 1500 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v1.id, patientId: p1.id, branchId: OUTRAM, amount: 500, mode: "CASH", collectedById: REC_O, receiptNo: "RCP-2026-00001", paymentDate: new Date("2026-06-20T10:35:00") })
  await payBundle({ paymentType: "TREATMENT", estimateId: e1.id, patientId: p1.id, branchId: OUTRAM, amount: 15000, mode: "UPI", collectedById: REC_O, receiptNo: "RCP-2026-00002", paymentDate: new Date("2026-06-20T12:40:00") })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 2 — Priya Singh · New Alipore · Pregnant
  // Scaling + Pit & Fissure Sealant — COMPLETED, fully paid
  // ─────────────────────────────────────────────────────────────
  const p2 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00002" }, update: {},
    create: {
      patientId: "PAT-2026-00002", registrationBranchId: ALIPORE,
      fullName: "Priya Singh", dateOfBirth: new Date("1998-07-22"), gender: "FEMALE",
      mobile: "9812345678", email: "priya.singh@gmail.com",
      address: "643B, Block-O, New Alipore, Kolkata - 700 053",
      leadSource: "Referral", referenceName: "Amit Kumar",
      reasonForVisit: "Gum bleeding and teeth sensitivity during pregnancy",
      createdById: REC_A,
    }
  })
  await makeHistory(p2.id, REC_A, {
    pregnant: true, gumsBleed: true, sensitiveTeeth: true,
    generalHealthNotes: "6 months pregnant — 2nd trimester. No significant systemic conditions.",
    lastDentistVisit: "1 year ago",
  })
  const v2 = await makeVisit({ no: "VISIT-2026-00002", patientId: p2.id, branchId: ALIPORE, doctorId: DR_C, type: "CONSULTATION", date: new Date("2026-06-21T11:00:00"), status: "COMPLETED", complaint: "Gum bleeding on brushing, tooth sensitivity", createdBy: REC_A })
  await makeQueue(v2.id, p2.id, ALIPORE, DR_C, 2, "COMPLETED", new Date("2026-06-21T11:00:00"), new Date("2026-06-21T12:00:00"), REC_A)
  await makeNote(p2.id, v2.id, DR_C, "EXAMINATION", "Patient 6 months pregnant (2nd trimester). Gingival enlargement due to hormonal changes — pregnancy gingivitis. Moderate supragingival calculus. No pain. Treatment limited to safe procedures for pregnancy — scaling and preventive care only.")
  await makeNote(p2.id, v2.id, DR_C, "TREATMENT_NOTE", "Gentle scaling performed — calculus removed. Oral hygiene instructions given. Soft toothbrush recommended. Pit and fissure sealants applied on molars as preventive measure. Advised to revisit for review post-delivery.")
  const e2 = await makeEstimate({ no: "EST-2026-00002", patientId: p2.id, branchId: ALIPORE, doctorId: DR_C, visitId: v2.id, status: "COMPLETED", notes: "Pregnancy safe treatments only — scaling + preventive sealants", items: [
    { name: "Scaling & Polishing", category: "PERIODONTICS", qty: 1, rate: 1500 },
    { name: "Pit & Fissure Sealant (per tooth)", category: "PEDODONTICS", qty: 4, rate: 600 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v2.id, patientId: p2.id, branchId: ALIPORE, amount: 500, mode: "CASH", collectedById: REC_A, receiptNo: "RCP-2026-00003", paymentDate: new Date("2026-06-21T11:05:00") })
  await payBundle({ paymentType: "TREATMENT", estimateId: e2.id, patientId: p2.id, branchId: ALIPORE, amount: 3900, mode: "UPI", collectedById: REC_A, receiptNo: "RCP-2026-00004", paymentDate: new Date("2026-06-21T12:05:00") })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 3 — Rahul Sharma · Salt Lake · Heart Problems
  // 3x Surgical Extraction + Partial Denture — COMPLETED, balance ₹5,500 outstanding
  // ─────────────────────────────────────────────────────────────
  const p3 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00003" }, update: {},
    create: {
      patientId: "PAT-2026-00003", registrationBranchId: SALTLAKE,
      fullName: "Rahul Sharma", dateOfBirth: new Date("1980-11-05"), gender: "MALE",
      mobile: "9900112233", email: "rahul.sharma@yahoo.com",
      address: "AL16, Sector II, Salt Lake, Kolkata - 700 091",
      leadSource: "Online", reasonForVisit: "Multiple missing and broken teeth, difficulty eating",
      createdById: REC_S,
    }
  })
  await makeHistory(p3.id, REC_S, {
    heartProblems: true, heartProblemsDetail: "Ischaemic heart disease — on medication",
    heartSurgery: true, heartSurgeryDetail: "Angioplasty 2022",
    bleedsEasily: true, bloodPressure: true, bloodPressureType: "HIGH",
    currentMedications: "Aspirin 75mg, Atorvastatin 40mg, Ramipril 5mg",
    generalHealthNotes: "Cardiac patient — clearance from cardiologist obtained before dental treatment.",
    looseTeeth: true, lastDentistVisit: "3 years ago",
  })
  const v3 = await makeVisit({ no: "VISIT-2026-00003", patientId: p3.id, branchId: SALTLAKE, doctorId: DR_D, type: "CONSULTATION", date: new Date("2026-06-22T10:00:00"), status: "COMPLETED", complaint: "3 broken teeth, multiple missing teeth, cannot chew properly", createdBy: REC_S })
  await makeQueue(v3.id, p3.id, SALTLAKE, DR_D, 1, "COMPLETED", new Date("2026-06-22T10:00:00"), new Date("2026-06-22T11:30:00"), REC_S)
  await makeNote(p3.id, v3.id, DR_D, "EXAMINATION", "Cardiac patient. Cardiologist clearance provided. Aspirin stopped 7 days pre-op as advised by cardiologist. Teeth #14, #24, #36 non-restorable — surgical extraction required. BP 145/88. OPG taken. Partial denture planned after healing.")
  await makeNote(p3.id, v3.id, DR_D, "TREATMENT_NOTE", "Surgical extractions #14, #24, #36 performed under LA. Hemostasis achieved. Sutures placed. Post-op instructions given. Partial denture impressions to be taken after 6 weeks healing. Follow-up scheduled.")
  const e3 = await makeEstimate({ no: "EST-2026-00003", patientId: p3.id, branchId: SALTLAKE, doctorId: DR_D, visitId: v3.id, status: "ACTIVE", notes: "Cardiac clearance obtained. 3 surgical extractions + partial denture for upper arch.", items: [
    { name: "Surgical Extraction", category: "ORAL SURGERY", tooth: "14", qty: 1, rate: 2500 },
    { name: "Surgical Extraction", category: "ORAL SURGERY", tooth: "24", qty: 1, rate: 2500 },
    { name: "Surgical Extraction", category: "ORAL SURGERY", tooth: "36", qty: 1, rate: 2500 },
    { name: "Partial Denture", category: "PROSTHODONTICS", qty: 1, rate: 8000 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v3.id, patientId: p3.id, branchId: SALTLAKE, amount: 500, mode: "CASH", collectedById: REC_S, receiptNo: "RCP-2026-00005", paymentDate: new Date("2026-06-22T10:05:00") })
  await payBundle({ paymentType: "ADVANCE", estimateId: e3.id, patientId: p3.id, branchId: SALTLAKE, amount: 5000, mode: "CASH", collectedById: REC_S, receiptNo: "RCP-2026-00006", paymentDate: new Date("2026-06-22T11:35:00") })
  await payBundle({ paymentType: "TREATMENT", estimateId: e3.id, patientId: p3.id, branchId: SALTLAKE, amount: 5000, mode: "CARD", collectedById: REC_S, receiptNo: "RCP-2026-00007", paymentDate: new Date("2026-06-22T11:40:00") })
  // Balance ₹5,500 still outstanding (partial denture not yet delivered)

  // ─────────────────────────────────────────────────────────────
  // PATIENT 4 — Sunita Devi · Outram · Allergies + Low BP
  // Complete Denture upper + lower — ESTIMATE_CREATED, advance paid
  // ─────────────────────────────────────────────────────────────
  const p4 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00004" }, update: {},
    create: {
      patientId: "PAT-2026-00004", registrationBranchId: OUTRAM,
      fullName: "Sunita Devi", dateOfBirth: new Date("1973-04-12"), gender: "FEMALE",
      mobile: "9874563210", email: "sunita.devi@rediffmail.com",
      address: "5, Shyambazar Street, Kolkata - 700 004",
      leadSource: "Walk-in", reasonForVisit: "All teeth missing, want dentures",
      createdById: REC_O,
    }
  })
  await makeHistory(p4.id, REC_O, {
    allergies: true, allergiesDetail: "Penicillin — causes rash",
    bloodPressure: true, bloodPressureType: "LOW",
    currentMedications: "Iron supplements, Vitamin B12",
    generalHealthNotes: "Edentulous. Lost all teeth over past 5 years due to advanced periodontitis.",
    lastDentistVisit: "5 years ago",
  })
  const v4 = await makeVisit({ no: "VISIT-2026-00004", patientId: p4.id, branchId: OUTRAM, doctorId: DR_J, type: "CONSULTATION", date: new Date("2026-06-24T10:00:00"), status: "IN_PROGRESS", complaint: "Complete edentulism — cannot chew food properly, appearance concern", createdBy: REC_O })
  await makeQueue(v4.id, p4.id, OUTRAM, DR_J, 4, "ESTIMATE_CREATED", new Date("2026-06-24T10:00:00"), undefined)
  await makeNote(p4.id, v4.id, DR_J, "EXAMINATION", "Patient is fully edentulous. Upper and lower ridges well-formed and adequate for conventional complete dentures. OPG taken — no retained roots. Allergy to Penicillin noted. Treatment plan: Complete Dentures upper and lower. Primary impressions taken today.")
  const e4 = await makeEstimate({ no: "EST-2026-00004", patientId: p4.id, branchId: OUTRAM, doctorId: DR_J, visitId: v4.id, status: "ACTIVE", notes: "Complete dentures both arches. Multiple visits required. Penicillin allergy — use alternative antibiotics.", items: [
    { name: "Complete Denture (per jaw)", category: "PROSTHODONTICS", qty: 1, rate: 12000 },
    { name: "Complete Denture (per jaw)", category: "PROSTHODONTICS", qty: 1, rate: 12000 },
    { name: "OPG (Panoramic X-Ray)", category: "ORAL MEDICINE & RADIOLOGY", qty: 1, rate: 800 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v4.id, patientId: p4.id, branchId: OUTRAM, amount: 500, mode: "CASH", collectedById: REC_O, receiptNo: "RCP-2026-00008", paymentDate: new Date("2026-06-24T10:05:00") })
  await payBundle({ paymentType: "ADVANCE", estimateId: e4.id, patientId: p4.id, branchId: OUTRAM, amount: 5000, mode: "UPI", collectedById: REC_O, receiptNo: "RCP-2026-00009", paymentDate: new Date("2026-06-24T11:00:00") })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 5 — Rohit Gupta · New Alipore · Smoker
  // Ceramic Braces + Scaling — COMPLETED, balance ₹16,500 outstanding
  // ─────────────────────────────────────────────────────────────
  const p5 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00005" }, update: {},
    create: {
      patientId: "PAT-2026-00005", registrationBranchId: ALIPORE,
      fullName: "Rohit Gupta", dateOfBirth: new Date("2003-09-18"), gender: "MALE",
      mobile: "9123456780", email: "rohit.gupta@gmail.com",
      address: "7, Tollygunge Road, Kolkata - 700 033",
      leadSource: "Social Media", reasonForVisit: "Crooked teeth, want braces",
      createdById: REC_A,
    }
  })
  await makeHistory(p5.id, REC_A, {
    smoker: true, appearanceConcern: true,
    generalHealthNotes: "Occasional smoker (5-6 cigarettes/day). Advised to quit for better orthodontic outcomes.",
    lastDentistVisit: "Never",
  })
  const v5 = await makeVisit({ no: "VISIT-2026-00005", patientId: p5.id, branchId: ALIPORE, doctorId: DR_C, type: "CONSULTATION", date: new Date("2026-06-18T14:00:00"), status: "COMPLETED", complaint: "Crowded upper and lower front teeth, embarrassed to smile", createdBy: REC_A })
  await makeQueue(v5.id, p5.id, ALIPORE, DR_C, 5, "COMPLETED", new Date("2026-06-18T14:00:00"), new Date("2026-06-18T15:30:00"), REC_A)
  await makeNote(p5.id, v5.id, DR_C, "EXAMINATION", "Angle Class I malocclusion with crowding in both arches. Overjet 4mm, overbite 30%. Teeth healthy — no cavities. Heavy calculus due to smoking. Treatment: Fixed orthodontic appliance (Ceramic) + scaling before bonding. Advised strongly to quit smoking during treatment as affects bone and gum health.")
  await makeNote(p5.id, v5.id, DR_C, "TREATMENT_NOTE", "Pre-orthodontic scaling done. Ceramic brackets bonded on upper and lower arches. 0.014 NiTi archwire placed. Patient instructed on oral hygiene with braces. Next appointment in 4 weeks. Total treatment time estimated 18-24 months.")
  const e5 = await makeEstimate({ no: "EST-2026-00005", patientId: p5.id, branchId: ALIPORE, doctorId: DR_C, visitId: v5.id, status: "ACTIVE", notes: "Ceramic braces 18-24 month treatment. Monthly visits required. No smoking during treatment.", items: [
    { name: "Scaling & Polishing", category: "PERIODONTICS", qty: 1, rate: 1500 },
    { name: "Ceramic Braces (full)", category: "ORTHODONTICS", qty: 1, rate: 35000 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v5.id, patientId: p5.id, branchId: ALIPORE, amount: 500, mode: "CASH", collectedById: REC_A, receiptNo: "RCP-2026-00010", paymentDate: new Date("2026-06-18T14:05:00") })
  await payBundle({ paymentType: "ADVANCE", estimateId: e5.id, patientId: p5.id, branchId: ALIPORE, amount: 20000, mode: "UPI", collectedById: REC_A, receiptNo: "RCP-2026-00011", paymentDate: new Date("2026-06-18T15:35:00") })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 6 — Ananya Bose · Salt Lake · HIV/AIDS
  // Dental Implant + Crown + OPG — COMPLETED, fully paid
  // ─────────────────────────────────────────────────────────────
  const p6 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00006" }, update: {},
    create: {
      patientId: "PAT-2026-00006", registrationBranchId: SALTLAKE,
      fullName: "Ananya Bose", dateOfBirth: new Date("1990-01-30"), gender: "FEMALE",
      mobile: "9867453210", email: "ananya.bose@gmail.com",
      address: "22, Lake Town Block A, Kolkata - 700 089",
      leadSource: "Referral", referenceName: "Dr. Priya Menon (Physician)",
      reasonForVisit: "Missing upper front tooth, want implant",
      createdById: REC_S,
    }
  })
  await makeHistory(p6.id, REC_S, {
    hivAids: true, currentMedications: "ART regimen — Tenofovir + Lamivudine + Efavirenz",
    generalHealthNotes: "CD4 count 650 (good immunity). Viral load undetectable. Cleared by physician for elective dental procedures. Universal precautions observed.",
    appearanceConcern: true, lastDentistVisit: "6 months ago",
  })
  const v6 = await makeVisit({ no: "VISIT-2026-00006", patientId: p6.id, branchId: SALTLAKE, doctorId: DR_J, type: "CONSULTATION", date: new Date("2026-06-15T11:00:00"), status: "COMPLETED", complaint: "Missing tooth #21 due to trauma 2 years ago", createdBy: REC_S })
  await makeQueue(v6.id, p6.id, SALTLAKE, DR_J, 2, "COMPLETED", new Date("2026-06-15T11:00:00"), new Date("2026-06-15T12:30:00"), REC_S)
  await makeNote(p6.id, v6.id, DR_J, "EXAMINATION", "HIV+ patient with well-controlled disease (CD4 650, undetectable VL). Physician clearance obtained. Tooth #21 missing. Adequate bone height and width confirmed on CBCT — 12mm height, 6mm width. Implant placement feasible. Universal precautions followed throughout.")
  await makeNote(p6.id, v6.id, DR_J, "TREATMENT_NOTE", "OPG and CBCT analysis completed. 3.75mm x 11mm implant (Nobel Biocare) placed at #21 position under LA. Torque value 35 Ncm. Healing cap placed. Patient instructed on implant care. Crown placement after 3 months osseointegration. Patient tolerated procedure well.")
  const e6 = await makeEstimate({ no: "EST-2026-00006", patientId: p6.id, branchId: SALTLAKE, doctorId: DR_J, visitId: v6.id, status: "COMPLETED", notes: "Implant at #21. CBCT pre-op. CD4 650 — good candidate. Nobel Biocare implant used.", items: [
    { name: "OPG (Panoramic X-Ray)", category: "ORAL MEDICINE & RADIOLOGY", qty: 1, rate: 800 },
    { name: "CBCT Scan", category: "ORAL MEDICINE & RADIOLOGY", qty: 1, rate: 3500 },
    { name: "Dental Implant (single tooth)", category: "IMPLANTOLOGY", tooth: "21", qty: 1, rate: 25000 },
    { name: "Implant Crown", category: "IMPLANTOLOGY", tooth: "21", qty: 1, rate: 8000 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v6.id, patientId: p6.id, branchId: SALTLAKE, amount: 500, mode: "CASH", collectedById: REC_S, receiptNo: "RCP-2026-00012", paymentDate: new Date("2026-06-15T11:05:00") })
  await payBundle({ paymentType: "TREATMENT", estimateId: e6.id, patientId: p6.id, branchId: SALTLAKE, amount: 37300, mode: "BANK_TRANSFER", collectedById: REC_S, receiptNo: "RCP-2026-00013", paymentDate: new Date("2026-06-15T12:35:00") })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 7 — Manish Agarwal · Outram · Epilepsy + Diabetes
  // 4x Extractions + Flexible Denture — COMPLETED, fully paid
  // ─────────────────────────────────────────────────────────────
  const p7 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00007" }, update: {},
    create: {
      patientId: "PAT-2026-00007", registrationBranchId: OUTRAM,
      fullName: "Manish Agarwal", dateOfBirth: new Date("1958-06-20"), gender: "MALE",
      mobile: "9432109876", email: "manish.agarwal@hotmail.com",
      address: "3, Bentinck Street, Kolkata - 700 001",
      leadSource: "Walk-in", reasonForVisit: "Loose and painful teeth",
      createdById: REC_O,
    }
  })
  await makeHistory(p7.id, REC_O, {
    epilepsy: true, epilepsyDetail: "Controlled with medication — last seizure 4 years ago",
    diabetes: true, bloodPressure: true, bloodPressureType: "HIGH",
    currentMedications: "Phenytoin 200mg OD, Metformin 1000mg BD, Telmisartan 40mg OD",
    generalHealthNotes: "Multiple systemic conditions — medically managed. Dental clearance from physician obtained.",
    looseTeeth: true, gumsBleed: true, lastDentistVisit: "10 years ago",
  })
  const v7 = await makeVisit({ no: "VISIT-2026-00007", patientId: p7.id, branchId: OUTRAM, doctorId: DR_J, type: "CONSULTATION", date: new Date("2026-06-10T09:30:00"), status: "COMPLETED", complaint: "4 very loose teeth, pain while eating, gums bleeding", createdBy: REC_O })
  await makeQueue(v7.id, p7.id, OUTRAM, DR_J, 1, "COMPLETED", new Date("2026-06-10T09:30:00"), new Date("2026-06-10T11:00:00"))
  await makeNote(p7.id, v7.id, DR_J, "EXAMINATION", "Elderly patient with epilepsy, diabetes and hypertension — all medically managed. Phenytoin gingival hyperplasia noted. Teeth #15, #25, #35, #45 Grade III mobility — non-restorable. Flexible partial denture planned for aesthetics and function. Glucose 180 mg/dL. BP 140/88.")
  await makeNote(p7.id, v7.id, DR_J, "TREATMENT_NOTE", "Simple extractions of teeth #15, #25, #35, #45 done. Bleeding controlled. Patient stable throughout. Flexible denture impressions taken at same visit (immediate denture protocol). Delivered flexible denture after healing. Patient very satisfied.")
  const e7 = await makeEstimate({ no: "EST-2026-00007", patientId: p7.id, branchId: OUTRAM, doctorId: DR_J, visitId: v7.id, status: "COMPLETED", notes: "Immediate flexible denture protocol. Phenytoin gingival hyperplasia noted. Monitor periodontal status.", items: [
    { name: "Simple Extraction", category: "ORAL SURGERY", tooth: "15", qty: 1, rate: 800 },
    { name: "Simple Extraction", category: "ORAL SURGERY", tooth: "25", qty: 1, rate: 800 },
    { name: "Simple Extraction", category: "ORAL SURGERY", tooth: "35", qty: 1, rate: 800 },
    { name: "Simple Extraction", category: "ORAL SURGERY", tooth: "45", qty: 1, rate: 800 },
    { name: "Flexible Denture", category: "PROSTHODONTICS", qty: 1, rate: 15000 },
  ]})
  await payBundle({ paymentType: "CONSULTATION", visitId: v7.id, patientId: p7.id, branchId: OUTRAM, amount: 500, mode: "CASH", collectedById: REC_O, receiptNo: "RCP-2026-00014", paymentDate: new Date("2026-06-10T09:35:00") })
  await payBundle({ paymentType: "TREATMENT", estimateId: e7.id, patientId: p7.id, branchId: OUTRAM, amount: 18200, mode: "CASH", collectedById: REC_O, receiptNo: "RCP-2026-00015", paymentDate: new Date("2026-06-10T11:05:00") })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 8 — Kavita Nair · New Alipore · No conditions
  // Porcelain Veneers + Whitening — WITH_DOCTOR right now
  // ─────────────────────────────────────────────────────────────
  const p8 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00008" }, update: {},
    create: {
      patientId: "PAT-2026-00008", registrationBranchId: ALIPORE,
      fullName: "Kavita Nair", dateOfBirth: new Date("1994-03-08"), gender: "FEMALE",
      mobile: "9988776655", email: "kavita.nair@gmail.com",
      address: "Block M, New Alipore, Kolkata - 700 053",
      leadSource: "Google", reasonForVisit: "Want smile makeover — veneers",
      createdById: REC_A,
    }
  })
  await makeHistory(p8.id, REC_A, {
    appearanceConcern: true,
    generalHealthNotes: "Healthy individual. No systemic conditions. Interested in cosmetic dentistry.",
    lastDentistVisit: "1 year ago",
  })
  const v8 = await makeVisit({ no: "VISIT-2026-00008", patientId: p8.id, branchId: ALIPORE, doctorId: DR_C, type: "CONSULTATION", date: new Date(), status: "IN_PROGRESS", complaint: "Wants smile makeover — stained teeth and slight spacing", createdBy: REC_A })
  await makeQueue(v8.id, p8.id, ALIPORE, DR_C, 6, "WITH_DOCTOR", new Date(Date.now() - 30 * 60000), undefined, REC_A)

  // ─────────────────────────────────────────────────────────────
  // PATIENT 9 — Deepak Verma · Salt Lake · High BP
  // All-on-4 Implants consultation — WAITING in queue
  // ─────────────────────────────────────────────────────────────
  const p9 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00009" }, update: {},
    create: {
      patientId: "PAT-2026-00009", registrationBranchId: SALTLAKE,
      fullName: "Deepak Verma", dateOfBirth: new Date("1982-12-25"), gender: "MALE",
      mobile: "9876001122", email: "deepak.verma@gmail.com",
      address: "BD Block, Sector I, Salt Lake, Kolkata - 700 064",
      leadSource: "Walk-in", reasonForVisit: "Almost all teeth lost, wants full mouth rehabilitation",
      createdById: REC_S,
    }
  })
  await makeHistory(p9.id, REC_S, {
    bloodPressure: true, bloodPressureType: "HIGH",
    currentMedications: "Losartan 50mg OD, Hydrochlorothiazide 12.5mg OD",
    generalHealthNotes: "Hypertensive patient, BP well controlled. Seeking full mouth rehabilitation.",
    looseTeeth: true, foodCatching: true, gumsBleed: true,
    lastDentistVisit: "5 years ago",
  })
  const v9 = await makeVisit({ no: "VISIT-2026-00009", patientId: p9.id, branchId: SALTLAKE, doctorId: DR_D, type: "CONSULTATION", date: new Date(), status: "IN_PROGRESS", complaint: "Almost all teeth missing or very loose, cannot eat solid food", createdBy: REC_S })
  await makeQueue(v9.id, p9.id, SALTLAKE, DR_D, 7, "WAITING", new Date(Date.now() - 10 * 60000), undefined, REC_S)
  await payBundle({ paymentType: "CONSULTATION", visitId: v9.id, patientId: p9.id, branchId: SALTLAKE, amount: 500, mode: "CASH", collectedById: REC_S, receiptNo: "RCP-2026-00016", paymentDate: new Date(Date.now() - 8 * 60000) })

  // ─────────────────────────────────────────────────────────────
  // PATIENT 10 — Neha Chatterjee · Outram · Orthodontic concern
  // Just registered — dental history filled, no visit yet
  // ─────────────────────────────────────────────────────────────
  const p10 = await prisma.patient.upsert({
    where: { patientId: "PAT-2026-00010" }, update: {},
    create: {
      patientId: "PAT-2026-00010", registrationBranchId: OUTRAM,
      fullName: "Neha Chatterjee", dateOfBirth: new Date("2007-05-14"), gender: "FEMALE",
      mobile: "9012345678", email: "neha.chatterjee@gmail.com",
      address: "12A, Jodhpur Park, Kolkata - 700 068",
      leadSource: "Friend / Family", referenceName: "Mrs. Chatterjee (Mother)",
      reasonForVisit: "Upper front teeth sticking out, wants braces",
      createdById: REC_O,
    }
  })
  await makeHistory(p10.id, REC_O, {
    appearanceConcern: true,
    generalHealthNotes: "Healthy 19-year-old. No systemic conditions. Parent accompanying.",
    lastDentistVisit: "2 years ago",
  })

  console.log("✅ 10 demo patients seeded with full treatment histories")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
