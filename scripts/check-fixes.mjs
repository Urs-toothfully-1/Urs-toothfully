/**
 * Self-check for the pure logic behind two bug fixes. No framework — run it with:
 *   node scripts/check-fixes.mjs
 *
 * Kept in sync by hand with lib/teeth.ts and lib/estimate-item.ts (both are a
 * dozen lines and have no imports, so they are inlined here rather than dragging
 * a TypeScript loader into the repo for two functions).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

// Guard against the sources drifting away from the copies exercised below.
const teethSrc = readFileSync(join(root, "lib/teeth.ts"), "utf8")
assert.ok(
  !teethSrc.includes("teeth.length} teeth`"),
  "toothLabel regressed: a multi-tooth selection is being collapsed to a bare count again"
)
const itemSrc = readFileSync(join(root, "lib/estimate-item.ts"), "utf8")
assert.ok(
  itemSrc.includes('s !== CUSTOM_TREATMENT ? s : undefined'),
  "treatmentIdOrNull regressed: the custom sentinel is no longer stripped"
)

// ── lib/teeth.ts ──────────────────────────────────────────────────────
const UPPER = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"]
const LOWER = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]

function toothLabel(value) {
  if (!value) return ""
  const teeth = value.split(",").map((t) => t.trim()).filter(Boolean)
  if (teeth.length === 0) return ""
  const set = new Set(teeth)
  const hasUpper = UPPER.every((t) => set.has(t))
  const hasLower = LOWER.every((t) => set.has(t))
  if (hasUpper && hasLower) return "All teeth"
  if (hasUpper) return "All upper teeth"
  if (hasLower) return "All lower teeth"
  return `${teeth.length > 1 ? "Teeth" : "Tooth"} ${teeth.join(", ")}`
}

assert.equal(toothLabel(""), "")
assert.equal(toothLabel(null), "")
assert.equal(toothLabel("46"), "Tooth 46")
assert.equal(toothLabel("16,15"), "Teeth 16, 15")
// The bug: seven teeth used to render as "7 teeth", hiding the selection.
assert.equal(toothLabel("18,17,16,15,14,13,12"), "Teeth 18, 17, 16, 15, 14, 13, 12")
assert.equal(toothLabel(UPPER.join(",")), "All upper teeth")
assert.equal(toothLabel(LOWER.join(",")), "All lower teeth")
assert.equal(toothLabel([...UPPER, ...LOWER].join(",")), "All teeth")

// ── lib/estimate-item.ts ──────────────────────────────────────────────
const CUSTOM_TREATMENT = "custom"
function treatmentIdOrNull(v) {
  const s = typeof v === "string" ? v.trim() : ""
  return s && s !== CUSTOM_TREATMENT ? s : undefined
}

// The bug: "custom" reached Prisma and blew up the estimate save with an FK error.
assert.equal(treatmentIdOrNull("custom"), undefined)
assert.equal(treatmentIdOrNull(""), undefined)
assert.equal(treatmentIdOrNull("  "), undefined)
assert.equal(treatmentIdOrNull(undefined), undefined)
assert.equal(treatmentIdOrNull(null), undefined)
assert.equal(treatmentIdOrNull("clx123abc"), "clx123abc")
assert.equal(treatmentIdOrNull(" clx123abc "), "clx123abc")

console.log("check-fixes: all assertions passed")
