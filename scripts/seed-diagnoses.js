const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const STANDARD_DIAGNOSES = [
  // General Dentistry
  {
    specialty: "General Dentistry",
    diagnoses: [
      "Dental caries (cavities) - requires restoration",
      "Recurrent caries under old restoration",
      "Caries with pulp involvement",
      "Enamel erosion from acid reflux",
      "Dental fluorosis",
      "Tooth wear from bruxism (grinding)",
      "Fractured cusp - needs crown",
      "Severe dental staining",
      "Early stage periodontal disease",
      "Plaque and tartar buildup",
      "Gingival inflammation",
      "Food impaction between teeth",
      "Poorly contoured restoration",
      "Overhanging restoration margin",
      "Tooth sensitivity - needs desensitization",
    ],
  },
  // Periodontics
  {
    specialty: "Periodontics",
    diagnoses: [
      "Chronic periodontitis - mild",
      "Chronic periodontitis - moderate",
      "Chronic periodontitis - severe",
      "Aggressive periodontitis",
      "Gingival recession with exposed root",
      "Gum recession with bone loss",
      "Periodontal pocketing (4-5mm)",
      "Periodontal pocketing (>6mm)",
      "Periapical abscess",
      "Gingival abscess",
      "Periodontal abscess",
      "Mucogingival defect",
      "Inadequate attached gingiva",
      "Gingival bleeding on probing",
      "Plunging ridge",
    ],
  },
  // Endodontics
  {
    specialty: "Endodontics",
    diagnoses: [
      "Reversible pulpitis",
      "Irreversible pulpitis",
      "Pulp necrosis",
      "Deep caries - needs root canal therapy",
      "Caries with periapical involvement",
      "Traumatic tooth injury - root intact",
      "Traumatic tooth injury - root fracture",
      "Failed endodontic treatment - needs re-treatment",
      "Post-treatment periapical lesion",
      "Vertical root fracture",
      "Internal resorption",
      "External resorption",
      "Tooth discoloration from endodontic procedure",
      "Symptomatic apical periodontitis",
      "Chronic apical periodontitis",
    ],
  },
  // Orthodontics
  {
    specialty: "Orthodontics",
    diagnoses: [
      "Class I malocclusion - mild crowding",
      "Class I malocclusion - moderate crowding",
      "Class I malocclusion - severe crowding",
      "Class II Division 1 malocclusion",
      "Class II Division 2 malocclusion",
      "Class III malocclusion",
      "Anterior open bite",
      "Anterior deep bite",
      "Anterior cross bite",
      "Posterior cross bite",
      "Unilateral cross bite",
      "Midline deviation",
      "Rotated teeth",
      "Impacted permanent tooth",
      "Congenitally missing tooth",
    ],
  },
  // Oral Surgery
  {
    specialty: "Oral Surgery",
    diagnoses: [
      "Surgical extraction required - impacted wisdom tooth",
      "Surgical extraction required - severe root resorption",
      "Surgical extraction required - failed orthodontic movement",
      "Soft tissue graft needed",
      "Bone graft needed for implant site",
      "Sinus lift procedure needed",
      "Cyst removal required",
      "Benign tumor requiring excision",
      "Severe jaw fracture - requires surgery",
      "TMJ dysfunction - requires surgery",
      "Sleep apnea - requires airway surgery",
      "Cleft palate repair",
      "Frenectomy needed",
      "Pre-implant bone augmentation",
      "Ridge augmentation needed",
    ],
  },
  // Prosthodontics
  {
    specialty: "Prosthodontics",
    diagnoses: [
      "Complete denture needed - upper arch",
      "Complete denture needed - lower arch",
      "Complete denture needed - both arches",
      "Partial denture needed - bounded saddle",
      "Partial denture needed - cantilever",
      "Implant-supported crown needed",
      "Implant-supported denture needed",
      "Fixed bridge needed - 3 units",
      "Fixed bridge needed - multiple units",
      "Failing restoration - needs remake",
      "Esthetic veneers needed",
      "Full mouth reconstruction needed",
      "Bite plane needed - bruxism",
      "Night guard needed",
      "Maxillofacial prosthesis needed",
    ],
  },
]

async function main() {
  try {
    console.log("🌱 Seeding standard diagnoses...\n")

    const branches = await prisma.branch.findMany()

    if (branches.length === 0) {
      console.error("❌ No branches found. Please create at least one branch first.")
      process.exit(1)
    }

    let totalCreated = 0

    for (const branch of branches) {
      console.log(`📍 Seeding for branch: ${branch.name}`)

      for (const { specialty, diagnoses } of STANDARD_DIAGNOSES) {
        for (const name of diagnoses) {
          // Check if already exists
          const existing = await prisma.diagnosis.findFirst({
            where: {
              branchId: branch.id,
              name,
              isStandard: true,
            },
          })

          if (!existing) {
            await prisma.diagnosis.create({
              data: {
                branchId: branch.id,
                name,
                specialty,
                isStandard: true,
                isActive: true,
              },
            })
            totalCreated++
          }
        }
        console.log(`  ✓ ${specialty}: ${diagnoses.length} diagnoses`)
      }
    }

    console.log(`\n✅ Seeded ${totalCreated} new diagnoses`)
    console.log(`📊 Total branches processed: ${branches.length}`)
  } catch (error) {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
