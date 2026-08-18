/**
 * Option lists shared by server actions and the forms that submit to them.
 *
 * These live here rather than beside the actions because a "use server" module
 * may only export async functions — a plain `export const` in one arrives as
 * `undefined` on the client, which crashes the first component that indexes it.
 */

/**
 * Groups for clinical phrases. DIAGNOSIS entries follow the clinic's reference
 * sheet (and are offered for On Examination too); COMPLAINT entries are grouped
 * by what the patient reports.
 */
export const PHRASE_SPECIALTIES = {
  DIAGNOSIS: [
    "General Dentistry / Restorative",
    "Periodontics",
    "Endodontics",
    "Orthodontics",
    "Oral & Maxillofacial Surgery",
    "Prosthodontics",
    "Pediatric Dentistry",
    "Oral Medicine / Pathology",
    "Advanced / Complex Cases & Oral Cancer",
  ],
  COMPLAINT: ["Pain", "Sensitivity", "Gums & Swelling", "Teeth & Function", "Other"],
} as const satisfies Record<"DIAGNOSIS" | "COMPLAINT", readonly string[]>

export const MEDICINE_CATEGORIES = [
  "Antibiotics",
  "Analgesics",
  "Anti-Inflammatory / Steroids",
  "Antiseptics / Mouth Rinses",
  "Antifungals",
  "Hemostatics",
  "Sedatives / Anxiolytics",
  "Fluoride & Remineralizing",
  "Desensitizing Agents",
  "Endodontic Medicaments",
  "Topical / Oral Ulcer",
  "Anti-Emetics",
  "Vitamins & Supplements",
  "Emergency / Anaphylaxis Kit",
  "Other",
] as const

/** Non-treatment items billed on their own: X-ray, lab tests, supplies. */
export const PRODUCT_CATEGORIES = [
  "X-ray",
  "Lab Test",
  "Imaging",
  "Diagnostic",
  "Supplies",
  "Other",
] as const
