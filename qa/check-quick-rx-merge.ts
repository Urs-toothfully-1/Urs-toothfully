/**
 * Self-check for the Quick Rx merge rules.
 *
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/check-quick-rx-merge.ts
 *
 * The merge is the one piece of real logic behind Quick Rx: it must never
 * overwrite what the doctor already wrote, and running it twice must not
 * duplicate entries. No database needed — mergeQuickRx is pure.
 */
import assert from "node:assert"
import { mergeQuickRx, quickRxSchema } from "@/server/services/prescription.service"
import type { PrescriptionData } from "@/lib/prescription-types"

const base = (over: Partial<PrescriptionData> = {}): PrescriptionData =>
  ({
    patient: { name: "T", patientId: "P1", age: 30, gender: "M", mobile: "9" },
    medicalAlerts: [],
    treatments: [],
    doctorName: "Dr T",
    branchName: "B",
    date: "2026-01-01",
    medicines: [],
    advice: "",
    ...over,
  }) as PrescriptionData

const input = quickRxSchema.parse({
  diagnoses: [{ diagnosisText: "Irreversible pulpitis", toothNumbers: ["16", "17"] }],
  medicines: [{ name: "Tab Augmentin 625mg", frequency: "1-0-1", duration: "5 days" }],
})

// 1. Writes into the fields the print page and the full editor actually read.
{
  const { data, findingsAdded, medicinesAdded } = mergeQuickRx(base(), input)
  assert.strictEqual(findingsAdded, 1)
  assert.strictEqual(medicinesAdded, 1)
  assert.deepStrictEqual(data.onExamination, [
    { toothNumbers: "16,17", finding: "Irreversible pulpitis" },
  ])
  assert.strictEqual(data.diagnosis, "Irreversible pulpitis (16, 17)")
  assert.strictEqual(data.medicines[0].name, "Tab Augmentin 625mg")
  assert.strictEqual(data.medicines[0].dosage, "", "dosage defaults, never undefined")
}

// 2. Idempotent — saving the same Quick Rx twice adds nothing.
{
  const once = mergeQuickRx(base(), input).data
  const twice = mergeQuickRx(once, input)
  assert.strictEqual(twice.findingsAdded, 0)
  assert.strictEqual(twice.medicinesAdded, 0)
  assert.deepStrictEqual(twice.data.onExamination, once.onExamination)
  assert.strictEqual(twice.data.diagnosis, once.diagnosis)
  assert.strictEqual(twice.data.medicines.length, 1)
}

// 3. Never clobbers what the doctor already entered in the full form.
{
  const existing = base({
    chiefComplaint: "Pain lower left",
    advice: "Soft diet",
    diagnosis: "Existing note",
    onExamination: [{ toothNumbers: "36", finding: "Deep caries" }],
    medicines: [{ name: "Tab Ibuprofen", dosage: "400mg", frequency: "1-1-1", duration: "3 days" }],
  })
  const { data } = mergeQuickRx(existing, input)
  assert.strictEqual(data.chiefComplaint, "Pain lower left")
  assert.strictEqual(data.advice, "Soft diet")
  assert.strictEqual(data.onExamination!.length, 2)
  assert.strictEqual(data.onExamination![0].finding, "Deep caries")
  assert.strictEqual(data.medicines.length, 2)
  assert.strictEqual(data.medicines[0].name, "Tab Ibuprofen")
  assert.strictEqual(data.diagnosis, "Existing note\nIrreversible pulpitis (16, 17)")
}

// 4. Same diagnosis on different teeth is a distinct finding, not a duplicate.
{
  const once = mergeQuickRx(base(), input).data
  const other = quickRxSchema.parse({
    diagnoses: [{ diagnosisText: "Irreversible pulpitis", toothNumbers: ["26"] }],
    medicines: [],
  })
  const { data, findingsAdded } = mergeQuickRx(once, other)
  assert.strictEqual(findingsAdded, 1)
  assert.strictEqual(data.onExamination!.length, 2)
}

// 5. Invalid FDI numbers are rejected before they can reach the record.
{
  for (const bad of ["10", "49", "5", "99", "abc", "1"]) {
    assert.strictEqual(
      quickRxSchema.safeParse({ diagnoses: [{ diagnosisText: "x", toothNumbers: [bad] }] }).success,
      false,
      `expected FDI "${bad}" to be rejected`
    )
  }
  for (const good of ["11", "18", "48", "31"]) {
    assert.strictEqual(
      quickRxSchema.safeParse({ diagnoses: [{ diagnosisText: "x", toothNumbers: [good] }] }).success,
      true,
      `expected FDI "${good}" to be accepted`
    )
  }
}

console.log("quick-rx merge: all checks passed")
