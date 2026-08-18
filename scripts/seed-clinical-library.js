/**
 * Seeds the clinical phrase library from the clinic's reference sheets.
 *
 *   node scripts/seed-clinical-library.js
 *
 * Additive and re-runnable: entries are matched on (branch, section, name) and
 * skipped if already present, so nothing the doctors added is overwritten and
 * running twice changes nothing.
 *
 * The terminology list is used for BOTH the Diagnosis and the On Examination
 * pickers — the source sheet marks it as applying to both.
 */
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const DIAGNOSES = {
  "General Dentistry / Restorative": [
    "Dental Caries (Incipient)", "Dental Caries (Moderate)", "Dental Caries (Deep)",
    "Rampant Caries", "Root Caries", "Recurrent/Secondary Caries",
    "Reversible Pulpitis", "Irreversible Pulpitis", "Acute Irreversible Pulpitis",
    "Chronic Irreversible Pulpitis", "Periapical Abscess", "Periodontal Abscess",
    "Generalised Attrition", "Generalised Abrasion", "Generalised Erosion",
    "Cervical Abfraction", "Cracked Tooth Syndrome", "Fractured Cusp",
    "Vertical Root Fracture", "Dental Fluorosis", "Dentin Hypersensitivity",
    "Amalgam Tattoo", "Failed Restoration",
    "Buccal Caries", "Lingual Caries", "Proximal Caries",
  ],
  Periodontics: [
    "Acute Gingivitis", "Chronic Periodontitis", "Aggressive Periodontitis",
    "Necrotizing Ulcerative Gingivitis (NUG)", "Necrotizing Periodontitis",
    "Periodontal Pocket", "Gingival Recession (Miller Class I-IV)",
    "Furcation Involvement (Grade I-III)", "Tooth Mobility (Grade I-III)",
    "Peri-implant Mucositis", "Peri-implantitis", "Gingival Hyperplasia/Overgrowth",
    "Vertical Bone Loss", "Horizontal Bone Loss",
    "Bone Defect (1-Wall / 2-Wall / 3-Wall)", "Alveolar Ridge Deficiency",
  ],
  Endodontics: [
    "Pulp Necrosis", "Symptomatic Apical Periodontitis", "Asymptomatic Apical Periodontitis",
    "Periapical Granuloma", "Periapical (Radicular) Cyst", "Internal Root Resorption",
    "External Root Resorption", "Failed Root Canal Treatment", "Perforation",
    "Dens Invaginatus", "Calcified Canal",
  ],
  Orthodontics: [
    "Class I Malocclusion", "Class II Malocclusion", "Class III Malocclusion",
    "Crowding", "Spacing/Diastema", "Overjet", "Overbite",
    "Anterior Crossbite", "Posterior Crossbite", "Open Bite",
    "Impacted Tooth", "Ectopic Eruption", "Midline Deviation",
  ],
  "Oral & Maxillofacial Surgery": [
    "Impacted Third Molar (Mesioangular/Distoangular/Vertical/Horizontal)",
    "Odontogenic Cyst", "Odontogenic Tumor", "Mandibular Fracture",
    "Maxillary Fracture (Le Fort I/II/III)", "TMJ Disorder (TMD)", "TMJ Ankylosis",
    "TMJ Internal Derangement", "Condylar Hyperplasia", "Oral Leukoplakia",
    "Oral Erythroplakia", "Osteomyelitis (Jaw)", "Dry Socket (Alveolar Osteitis)",
    "Cellulitis (Odontogenic)", "Ludwig's Angina",
    "Osteonecrosis of the Jaw (ONJ / MRONJ)",
  ],
  Prosthodontics: [
    "Partial Edentulism", "Complete Edentulism", "Missing Teeth (Single/Multiple)",
    "Denture Stomatitis", "Angular Cheilitis", "Failed Fixed Prosthesis (Bridge)",
    "Implant Failure (Early/Late)", "Residual Ridge Resorption",
    "Occlusal Vertical Dimension Loss", "Full Mouth Rehabilitation",
    "Anterior Guidance Lost", "Canine Guidance Lost", "Occlusal Collapse",
    "Generalized Tooth Wear/Erosion", "Masseter and Temporalis Muscle Tenderness",
    "Centric Relation is not Co-incident with Centric Occlusion",
    "Complex Restorative Case",
  ],
  "Pediatric Dentistry": [
    "Early Childhood Caries (ECC)", "Severe Early Childhood Caries (S-ECC)",
    "Natal/Neonatal Teeth", "Premature Tooth Loss", "Space Maintainer Need",
    "Dental Trauma (Avulsion/Luxation/Fracture)",
    "Molar Incisor Hypomineralization (MIH)", "Nursing Bottle Caries",
  ],
  "Oral Medicine / Pathology": [
    "Aphthous Ulcer (Minor/Major/Herpetiform)", "Oral Lichen Planus",
    "Oral Candidiasis (Thrush)", "Herpetic Gingivostomatitis", "Xerostomia",
    "Halitosis", "Burning Mouth Syndrome", "Geographic Tongue",
    "Fibroma (Traumatic/Irritation)", "Mucocele", "Pyogenic Granuloma",
  ],
  "Advanced / Complex Cases & Oral Cancer": [
    "Oral Squamous Cell Carcinoma (OSCC)", "Verrucous Carcinoma",
    "Oral Cancer - Stage I-IV", "Suspicious/Non-healing Ulcer (Biopsy Indicated)",
    "Leukoplakia with Dysplasia", "Erythroleukoplakia",
    "Oral Submucous Fibrosis (OSMF)", "Lymphadenopathy (Cervical, Cancer-related)",
    "Metastatic Oral Lesion", "Salivary Gland Tumor (Benign/Malignant)",
    "Post-Radiation Osteoradionecrosis",
    "MRONJ (Medication-Related Osteonecrosis of Jaw)",
    "Full Mouth Rehabilitation (Post-Trauma/Pathology)",
    "Full Mouth Rehabilitation (Bruxism/Wear Case)", "Complex Bone Grafting Case",
    "Sinus Lift / Bone Augmentation Required", "Severe Alveolar Bone Resorption",
    "Multiple Missing Teeth (Partial Arch)", "Complete Arch Tooth Loss",
    "Combination Syndrome", "Terminal Dentition", "Hopeless Tooth/Teeth",
    "Full Arch Implant Rehabilitation", "Maxillomandibular Reconstruction",
    "Post-Surgical Oral Defect",
  ],
}

// Patient-reported complaints. Deliberately plain wording — this is what the
// patient says, not the clinician's term. Doctors add their own from the picker.
const COMPLAINTS = {
  Pain: [
    "Pain in tooth", "Pain on chewing", "Pain radiating to ear/head",
    "Continuous throbbing pain", "Pain at night",
  ],
  Sensitivity: [
    "Sensitivity to cold", "Sensitivity to hot", "Sensitivity to sweet",
  ],
  "Gums & Swelling": [
    "Swelling in gums", "Swelling on face", "Bleeding gums", "Pus discharge from gums",
    "Receding gums",
  ],
  "Teeth & Function": [
    "Loose tooth", "Broken/fractured tooth", "Food lodgement between teeth",
    "Difficulty chewing", "Difficulty opening mouth", "Clicking sound in jaw",
    "Missing tooth - wants replacement", "Discoloured tooth", "Irregular/crooked teeth",
  ],
  Other: [
    "Bad breath", "Ulcer in mouth", "Dry mouth", "Burning sensation in mouth",
    "Routine check-up", "Wants cleaning/scaling",
  ],
}

const MEDICINES = {
  Antibiotics: [
    "Cap Mox CV 250mg", "Cap Mox 500mg", "Tab Augmentin 375mg", "Tab Augmentin 625mg",
    "Tab Augmentin 1g", "Tab Moxikind CV 375mg", "Tab Moxikind CV 625mg",
    "Tab Clavam 375mg", "Tab Clavam 625mg", "Tab Flagyl 200mg", "Tab Flagyl 400mg",
    "Tab Metrogyl 400mg", "Cap Dalacin C 150mg", "Cap Dalacin C 300mg",
    "Cap Clindac 150mg", "Cap Clindac 300mg", "Tab Azithral 250mg", "Tab Azithral 500mg",
    "Cap Cephadex 250mg", "Cap Cephadex 500mg", "Cap Sporidex 250mg", "Cap Sporidex 500mg",
    "Tab Doxy 1 100mg", "Cap Doxt SL 100mg", "Tab Ciplox 250mg", "Tab Ciplox 500mg",
    "Tab Cifran 250mg", "Tab Cifran 500mg",
  ],
  Analgesics: [
    "Tab Crocin 500mg", "Tab Crocin 650mg", "Tab Dolo 650mg", "Tab Calpol 500mg",
    "Tab Brufen 400mg", "Tab Brufen 600mg", "Tab Combiflam 400/325mg", "Tab Voveran 50mg",
    "Tab Voltaren 50mg", "Tab Voltaren SR 100mg", "Tab Voveran K 50mg", "Tab Zerodol 100mg",
    "Tab Hifenac 100mg", "Tab Naprosyn 250mg", "Tab Ketorol DT", "Cap Tramazac 50mg",
    "Tab Zerodol P 100/325mg", "Tab Hifenac P 100/325mg", "Tab Ibugesic Plus 400/325mg",
  ],
  "Anti-Inflammatory / Steroids": [
    "Tab Wysolone 5mg", "Tab Wysolone 10mg", "Tab Wysolone 20mg", "Tab Omnacortil 5mg",
    "Tab Omnacortil 10mg", "Tab Omnacortil 20mg", "Tab Decadron 0.5mg", "Tab Dexona 0.5mg",
    "Tab Betnesol 0.5mg", "Tab Danzen 5mg", "Tab Danzen 10mg", "Tab Zerodol SP 100/15mg",
  ],
  "Antiseptics / Mouth Rinses": [
    "Rinse Hexidine 0.12%", "Rinse Hexidine 0.2%", "Rinse Clohex 0.2%", "Rinse Rexidin 0.2%",
    "Rinse Peridex 0.12%", "Sol Betadine Gargle 5%", "Rinse Colgate Plax 0.05%",
    "Gel Hexigel 1%", "Rinse Oradex 0.2%",
  ],
  Antifungals: [
    "Susp Mycostatin 100000 IU/ml", "Susp Nystaderm 100000 IU/ml", "Gel Candid Mouth Paint 1%",
    "Gel Canesten Mouth Paint 1%", "Cap Flucan 50mg", "Cap Flucan 150mg", "Cap Forcan 50mg",
    "Cap Forcan 150mg", "Gel Daktarin Oral 2%",
  ],
  Hemostatics: [
    "Tab Pause 500mg", "Tab Trapic 500mg", "Gauze Surgicel Standard",
    "Sponge Gelfoam Standard", "Sol Astringedent 15.5%",
  ],
  "Sedatives / Anxiolytics": [
    "Tab Valium 5mg", "Tab Valium 10mg", "Tab Calmpose 5mg", "Tab Calmpose 10mg",
    "Inj Fulsed 1mg/ml", "Inj Mezolam 1mg/ml", "Tab Alprax 0.25mg", "Tab Alprax 0.5mg",
    "Tab Restyl 0.25mg", "Tab Restyl 0.5mg",
  ],
  "Fluoride & Remineralizing": [
    "Varnish Duraphat 5%", "Varnish Fluor Protector 0.1%", "Gel Flurashield APF 1.23%",
    "Cream GC Tooth Mousse 10%", "Cream MI Paste 10%", "Sol Riva Star 38%",
    "Sol Advantage Arrest 38%",
  ],
  "Desensitizing Agents": [
    "Paste Sensodyne 5%", "Paste Colgate Sensitive 5%", "Sol Gluma Desensitizer 5%",
    "Sol D Sense Crystal",
  ],
  "Endodontic Medicaments": [
    "Paste Metapex CaOH+Iodoform", "Paste RC Cal CaOH", "Paste Ultracal 35%",
    "Gel RC Prep 15%", "Gel Glyde 15%", "Sol Prime Dental NaOCl 3%",
    "Sol Prime Dental NaOCl 5%", "Sol Parcan 3%", "Kit ProRoot MTA", "Kit MTA Angelus",
    "Paste Metapaste CaOH+Iodoform",
  ],
  "Topical / Oral Ulcer": [
    "Paste Kenacort Oral 0.1%", "Paste Tess Buccal 0.1%", "Gel Lox 2%",
    "Gel Xylocaine Jelly 2%", "Rinse Tantum Verde 0.15%", "Gel Mucopain 20%",
  ],
  "Anti-Emetics": [
    "Tab Emeset 4mg", "Tab Emeset 8mg", "Tab Ondem 4mg", "Tab Ondem 8mg",
    "Tab Domstal 10mg",
  ],
  "Vitamins & Supplements": [
    "Tab Limcee 500mg", "Tab Celin 500mg", "Cap Becosules Standard",
    "Tab Neurobion Standard", "Tab Shelcal 500mg", "Tab Calcimax Standard",
    "Tab Folvite 5mg",
  ],
  "Emergency / Anaphylaxis Kit": [
    "Inj Efcorlin 100mg", "Inj Avil 25mg", "Tab Avil 25mg", "Tab Piriton 4mg",
    "Inhaler Asthalin 100mcg",
  ],
}

async function main() {
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } })
  if (branches.length === 0) throw new Error("No branches found — seed branches first.")

  for (const branch of branches) {
    let addedPhrases = 0
    let skippedPhrases = 0
    let addedMedicines = 0
    let skippedMedicines = 0

    const phrases = [
      ...Object.entries(DIAGNOSES).flatMap(([specialty, names]) =>
        names.map((name) => ({ name, specialty, section: "DIAGNOSIS" }))
      ),
      ...Object.entries(COMPLAINTS).flatMap(([specialty, names]) =>
        names.map((name) => ({ name, specialty, section: "COMPLAINT" }))
      ),
    ]

    for (const p of phrases) {
      const existing = await prisma.diagnosis.findUnique({
        where: {
          branchId_section_name: { branchId: branch.id, section: p.section, name: p.name },
        },
        select: { id: true },
      })
      if (existing) {
        skippedPhrases++
        continue
      }
      await prisma.diagnosis.create({
        data: {
          branchId: branch.id,
          name: p.name,
          specialty: p.specialty,
          section: p.section,
          isStandard: true,
          isActive: true,
        },
      })
      addedPhrases++
    }

    for (const [category, names] of Object.entries(MEDICINES)) {
      for (const name of names) {
        const existing = await prisma.medicine.findUnique({
          where: { branchId_name: { branchId: branch.id, name } },
          select: { id: true },
        })
        if (existing) {
          skippedMedicines++
          continue
        }
        await prisma.medicine.create({
          data: { branchId: branch.id, name, category, isActive: true },
        })
        addedMedicines++
      }
    }

    console.log(
      `${branch.name}: phrases +${addedPhrases} (${skippedPhrases} already present), ` +
        `medicines +${addedMedicines} (${skippedMedicines} already present)`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
