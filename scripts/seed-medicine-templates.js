const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const MEDICINE_TEMPLATES = [
  {
    name: "Antibiotic + Painkiller",
    description: "Common post-extraction protocol",
    items: [
      { medicine: "Tab Augmentin 625mg", frequency: "1-0-1", duration: "5 days", sortOrder: 1 },
      { medicine: "Tab Ibuprofen 400mg", frequency: "1-1-1", duration: "3 days", sortOrder: 2 },
    ],
  },
  {
    name: "Post-RCT Protocol",
    description: "Root canal treatment follow-up",
    items: [
      { medicine: "Tab Amoxicillin 500mg", frequency: "1-0-1", duration: "5 days", sortOrder: 1 },
      { medicine: "Tab Metronidazole 400mg", frequency: "0-1-0", duration: "5 days", sortOrder: 2 },
      { medicine: "Tab Paracetamol 650mg", frequency: "1-0-1", duration: "3 days", sortOrder: 3 },
    ],
  },
  {
    name: "Periodontal Treatment",
    description: "Gum disease management",
    items: [
      { medicine: "Tab Doxycycline 100mg", frequency: "1-0-1", duration: "7 days", sortOrder: 1 },
      { medicine: "Chlorhexidine Mouthwash", frequency: "0-1-1", duration: "14 days", sortOrder: 2 },
      { medicine: "Tab Ibuprofen 400mg", frequency: "1-0-1", duration: "5 days", sortOrder: 3 },
    ],
  },
  {
    name: "Allergy Management",
    description: "For allergic reactions",
    items: [
      { medicine: "Tab Cetirizine 10mg", frequency: "0-0-1", duration: "5 days", sortOrder: 1 },
      { medicine: "Cough Syrup", frequency: "1-0-1", duration: "5 days", sortOrder: 2 },
    ],
  },
  {
    name: "Extraction Aftercare",
    description: "Post-extraction wound care",
    items: [
      { medicine: "Tab Augmentin 625mg", frequency: "1-0-1", duration: "5 days", sortOrder: 1 },
      { medicine: "Tab Ibuprofen 400mg", frequency: "1-1-1", duration: "3 days", sortOrder: 2 },
      { medicine: "Chlorhexidine Mouthwash", frequency: "0-1-1", duration: "7 days", sortOrder: 3 },
    ],
  },
]

async function main() {
  try {
    console.log("🌱 Seeding medicine templates...\n")

    const branches = await prisma.branch.findMany()

    if (branches.length === 0) {
      console.error("❌ No branches found. Please create at least one branch first.")
      process.exit(1)
    }

    let totalCreated = 0

    // Get a default user for createdBy
    const defaultUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    })

    if (!defaultUser) {
      console.error("❌ No admin user found for seeding")
      process.exit(1)
    }

    for (const branch of branches) {
      console.log(`📍 Seeding for branch: ${branch.name}`)

      for (const template of MEDICINE_TEMPLATES) {
        const existing = await prisma.medicineTemplate.findFirst({
          where: {
            branchId: branch.id,
            name: template.name,
          },
        })

        if (!existing) {
          const created = await prisma.medicineTemplate.create({
            data: {
              branchId: branch.id,
              name: template.name,
              description: template.description,
              createdBy: defaultUser.id,
              items: {
                create: template.items,
              },
            },
            include: { items: true },
          })

          console.log(`  ✓ Created template: "${template.name}" (${template.items.length} items)`)
          totalCreated++
        }
      }
    }

    console.log(`\n✅ Seeded ${totalCreated} new templates`)
    console.log(`📊 Total branches processed: ${branches.length}`)
  } catch (error) {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
