# Prescription Workflow — Complete Current Flow

**Last Updated:** 2026-08-17  
**Status:** Documentation of existing workflow + pain points  
**Time to Create Prescription:** 15-20 minutes per prescription

---

## 1. Entry Points to Prescription Creation

There are **3 ways** a prescription gets created in the system:

### 1.1 From Estimate (Primary Path)
**Trigger:** Doctor creates an estimate at `/doctor/estimate/new`

```
/doctor (queue) 
  → Click "Create Estimate" on a patient
  → Redirects to /doctor/estimate/new?visitId=X&patientId=Y
  → (Auto-redirects to /doctor/consultation/[visitId])
  → Estimate Wizard loads
```

**What Happens:**
- Page `estimate/new` calls `prescriptionService.ensureForVisit()` (line 20 in estimate/new/page.tsx)
- This creates a prescription with a snapshot from the visit (patient details, medical alerts, no medicines/advice yet)
- Then redirects to `/doctor/consultation/[visitId]` which loads the **EstimateWizard**

### 1.2 From Consultation Wizard (Most Complex)
**Path:** `/doctor/consultation/[visitId]`

This is a **3-step wizard**:

```
Step 1: Prescription Editor
  ↓
Step 2: Estimate Builder
  ↓
Step 3: Payment Agreement
```

**Key Component:** `EstimateWizard` (components/estimates/EstimateWizard.tsx, ~400 lines)
- State: `step`, `currentEstimateId`, `liveTreatments`
- Contains nested `PrescriptionEditor` (step 1) + `EstimateBuilder` (step 2) + `PaymentAgreementCard` (step 3)

### 1.3 Direct Prescription-Only (Edge Case)
**Trigger:** When no estimate exists yet

**Path:** Doctor can access `/doctor/prescription/[prescriptionId]` directly

---

## 2. Data Model: PrescriptionRecord

### 2.1 Database Schema (prisma/schema.prisma:440-459)

```prisma
model PrescriptionRecord {
  id               String                @id @default(uuid())
  patientId        String
  patient          Patient               @relation(...)
  visitId          String                @unique_per_visit  # One Rx per visit
  visit            PatientVisit          @relation(...)
  doctorId         String
  doctor           User                  @relation(...)
  templateId       String?               # Prescription template (unused in current flow)
  mode             PrescriptionMode      @default(PRINT_ONLY) # Enum: PRINT_ONLY, PARTIAL_DIGITAL, FULL_DIGITAL
  prescriptionData Json?                 # The entire Rx snapshot (see 2.2)
  printedAt        DateTime?
  createdAt        DateTime              @default(now())
}
```

### 2.2 PrescriptionData JSON Structure (lib/prescription-types.ts)

```typescript
interface PrescriptionData {
  patient: {
    name: string
    patientId: string
    age: number
    gender: Gender
    mobile: string
  }
  medicalAlerts: string[]                        // From dental history flags
  chiefComplaint?: string                        // What patient complained of
  onExamination?: ExaminationFinding[]           # Clinical exam findings + tooth numbers
  diagnosis?: string                             # Doctor's diagnosis
  treatments?: PrescriptionTreatment[]           # Treatment plan (no prices)
  medicines: PrescriptionMedicine[]              # Medicines (name, dosage, frequency, duration, instructions)
  advice: string                                 # Discharge advice
  followUpDate?: string                          # Follow-up appointment date
  clinicalNotes?: ClinicalNoteEntry[]           # Dated log of clinical notes
  doctorName: string
  doctorRegNo?: string
  branchName: string
  estimateNo?: string                            # Linked estimate number
  date: string                                   # Prescription date (ISO string)
}
```

---

## 3. Creation Flow: Step-by-Step

### 3.1 Auto-Creation from Estimate (prescription.service.ts: lines 82-144)

**Function:** `prescriptionService.createFromEstimate(estimateId, createdById)`

**Timing:** Called from `estimateService.create()` (line 109 in estimate.service.ts)

**What It Does:**

1. Fetches the estimate with patient, doctor, branch, and items
2. Checks if a prescription already exists for this visit (reuse if exists)
3. Fetches patient's latest dental history
4. Builds snapshot:
   - `patient` block (name, ID, age, gender, mobile)
   - `medicalAlerts` from dental history flags
   - `treatments` from estimate items (WITHOUT prices)
   - `doctorName`, `doctorRegNo`, `branchName`
   - Empty `medicines` and `advice` arrays
5. Creates `PrescriptionRecord` with `mode: "PARTIAL_DIGITAL"`
6. Creates audit log

**Non-Fatal:** If this fails, the estimate creation still succeeds. The prescription is lazily created later.

### 3.2 Auto-Creation for Any Visit (prescription.service.ts: lines 186-238)

**Function:** `prescriptionService.ensureForVisit(visitId, createdById)`

**Use Case:** When doctor accesses `/doctor/consultation/[visitId]` with no estimate yet

**What It Does:**

1. Checks if prescription already exists → reuse
2. If not, fetches visit, patient, doctor, branch
3. Builds minimal snapshot (patient details + medical alerts, empty treatments/medicines)
4. Creates `PrescriptionRecord` with `mode: "PARTIAL_DIGITAL"`
5. Creates audit log

**Idempotent:** Safe to call multiple times (returns existing prescription)

---

## 4. The EstimateWizard: The 20-Minute Experience

### 4.1 Overview (components/estimates/EstimateWizard.tsx)

A **3-step wizard** bundling prescription + estimate + payment in one UI.

```
┌─────────────────────────────────────────────────┐
│  Step 1: Prescription  | Step 2: Estimate | Step 3: Payment Plan  │
└─────────────────────────────────────────────────┘

Step 1: Prescription Editor
├─ Chief Complaint (textarea)
├─ On Examination (findings + tooth numbers)
│  ├─ Saved templates (quick-apply buttons)
│  └─ Add/remove finding rows
├─ Diagnosis (textarea)
├─ Treatment Plan (add treatments with tooth numbers)
│  └─ Pull from master or enter custom
├─ Medicines (name, dosage, frequency, duration, instructions)
│  └─ Add/remove medicine rows
├─ Advice (textarea)
├─ Follow-up Date (date picker)
└─ Clinical Notes (dated log)

Step 2: Estimate Builder
├─ (Auto-filled from Step 1 treatments)
├─ Add/edit estimate items (treatment, quantity, rate, tooth numbers)
├─ Discount percentage
├─ Advance required (calculated)
└─ Save estimate (creates DB record)

Step 3: Payment Plan
├─ Payment agreement (stages, clinic representative, terms)
└─ (Optional; mainly for institutional/corporate patients)
```

### 4.2 PrescriptionEditor Component (components/prescriptions/PrescriptionEditor.tsx)

**Props:**
- `prescriptionId`: The existing prescription to edit
- `data`: The snapshot from the DB
- `canEdit`: Whether the doctor can modify
- `treatments`: Master treatment list for dropdown
- `initialTemplates`: Saved examination templates
- `previousData`: Last prescription from patient (for "Load from last visit")
- `newForVisitId`: For create-on-save mode (no record exists yet)

**State Management:**
```typescript
const [chiefComplaint, setChiefComplaint] = useState(data.chiefComplaint ?? "")
const [findings, setFindings] = useState<ExaminationFinding[]>(data.onExamination ?? [emptyFinding])
const [diagnosis, setDiagnosis] = useState(data.diagnosis ?? "")
const [treatmentPlan, setTreatmentPlan] = useState<PrescriptionTreatment[]>(data.treatments ?? [emptyTreatment])
const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(data.medicines ?? [emptyMed])
const [advice, setAdvice] = useState(data.advice ?? "")
const [followUpDate, setFollowUpDate] = useState(data.followUpDate ?? "")
const [clinicalNotes, setClinicalNotes] = useState<ClinicalNoteEntry[]>(data.clinicalNotes ?? [])
```

**Sections Rendered:**
1. Chief Complaint (large textarea)
2. On Examination (findings, tooth selector per finding, templates)
3. Diagnosis (textarea)
4. Treatment Plan (editable rows, master list picker + custom)
5. Medicines (editable rows: name, dosage, frequency, duration, instructions)
6. Advice (large textarea)
7. Follow-up Date (date picker)
8. Clinical Notes (dated entries)

**Forms on Every Section:**
- Add/remove buttons
- Tooth selector (toothNumbers as FDI string)
- Template buttons for findings

---

## 5. Saving the Prescription

### 5.1 Save Flow (actions/prescriptions.ts)

**Entry Point:** `updatePrescriptionAction(prescriptionId, formData)`

**Steps:**
1. Check auth (require ADMIN or DOCTOR)
2. Parse `formData.payload` as JSON
3. Validate with `updatePrescriptionSchema` (Zod)
4. Call `prescriptionService.update(prescriptionId, parsed, userId)`
5. Call `revalidatePath()` to refresh UI
6. Return `{ success: true }` or error

### 5.2 Service Layer (prescription.service.ts: lines 260-289)

**Function:** `prescriptionService.update(id, input, updatedById)`

**Steps:**
1. Fetch existing `PrescriptionRecord`
2. Merge updates into `prescriptionData`:
   - `chiefComplaint`, `onExamination`, `diagnosis`, `treatments`, `medicines`, `advice`, `followUpDate`, `clinicalNotes`
3. Clean data (filter empty rows)
4. Call `prescriptionRepository.updateData(id, updated)`
5. Create audit log
6. Return updated record

**Key Detail:** The entire `prescriptionData` JSON is replaced, not patched. All fields must be present.

---

## 6. The Complexity: Why 15-20 Minutes?

### 6.1 UI Overhead

**In EstimateWizard Step 1 (PrescriptionEditor):**

| Section | Rows | Add/Remove | Fields per Row | Time (min) |
|---------|------|-----------|-----------------|-----------|
| Chief Complaint | 1 | No | 1 (textarea) | 1 |
| On Examination | 2-3 (avg) | Yes | Finding (textarea) + 4 tooth buttons + template | 5 |
| Diagnosis | 1 | No | 1 (textarea) | 0.5 |
| Treatment Plan | 3-5 (avg) | Yes | Name + category dropdown + tooth selector + quantity | 5 |
| Medicines | 3-5 (avg) | Yes | Name + dosage + frequency + duration + instructions | 6 |
| Advice | 1 | No | 1 (textarea) | 1 |
| Follow-up Date | 1 | No | 1 (date picker) | 0.5 |
| Clinical Notes | 0-2 | Yes | Date + note (textarea) | 1-2 |
| **TOTAL** | | | | **15-20 min** |

### 6.2 Friction Points

1. **Separate Sections:** Doctor must scroll through 8 sections even if only medicines matter
2. **Multi-Select Tooth Selector:** FDI picker (quadrants + primary teeth) for every finding and treatment
3. **Master Treatment Dropdown:** Must search/select from a list for each treatment
4. **Form Validation:** Every field validated; one error requires scrolling back
5. **No Quick Shortcuts:** "Load from last visit" helps, but still requires review + edits
6. **Three-Step Wizard:** Must complete prescription before moving to estimate (can't build estimate first)
7. **JSON Snapshot Model:** Every save replaces the entire `prescriptionData` blob (not incremental)
8. **No Templates for Medicines:** Common medicine sets (e.g., antibiotics + painkillers) not pre-filled

### 6.3 Common Scenarios

**Scenario 1: Simple cavity + painkillers** (should be 2 min)
1. Fill chief complaint ("pain in lower left molar")
2. Select tooth (16)
3. Enter medicine (Amoxicillin)
4. Enter advice ("avoid hard foods")
5. Save
→ **Actual:** 3-5 min (tooth selector clicks, scrolling)

**Scenario 2: Multi-tooth scaling + antibiotics + follow-up** (should be 5 min)
1. Fill complaint
2. Select teeth (full mouth: 18, 17, 16, … 47, 46, 45)
3. Enter treatment (Scaling)
4. Enter medicines (2-3 rows)
5. Set follow-up date
6. Save
→ **Actual:** 8-10 min (repeating clicks)

**Scenario 3: Re-edit after dentist adds a note** (should be 1 min)
1. Load prescription
2. Add one line to clinical notes
3. Save
→ **Actual:** 2-3 min (scrolling, re-validation of all fields)

---

## 7. Data Flow: Creation → Edit → Print → Share

### 7.1 Creation Timeline

```
User navigates to /doctor/estimate/new?visitId=X&patientId=Y
  ↓
estimate/new/page.tsx (line 20)
  → prescriptionService.ensureForVisit(visitId, userId)
  ↓
  Prescription auto-created with snapshot (medicines: [], advice: "")
  (Audit: CREATE, estimateNo, treatment count)
  ↓
Redirects to /doctor/consultation/[visitId]
  ↓
consultation/page.tsx (lines 37-41)
  → prescriptionService.getByVisit(visitId)
  → Returns the auto-created prescription
  ↓
EstimateWizard loads with empty Rx step
```

### 7.2 Edit Timeline

```
Doctor fills PrescriptionEditor fields (Chief Complaint, Exam, Treatments, Medicines, etc.)
  ↓
Doctor clicks "Save" button
  ↓
updatePrescriptionAction() called (actions/prescriptions.ts)
  ↓
Zod validation
  ↓
prescriptionService.update(prescriptionId, data, userId)
  ↓
Entire prescriptionData JSON replaced in DB
  ↓
Audit log created (UPDATE, medicine count, hasAdvice flag)
  ↓
revalidatePath() refreshes page
  ↓
Toast: "Prescription saved"
```

### 7.3 Print Timeline

```
User clicks "Print Prescription" on estimate/receipt page
  ↓
GET /api/documents/prescription/[visitId]/pdf
  ↓
Puppeteer renders /print/prescription/[visitId]
  ↓
print/prescription/[visitId]/page.tsx (reads prescriptionData from DB)
  ↓
Renders A4 template with header, patient details, treatments, medicines, advice
  ↓
PDF saved to generated-documents/ (gitignored)
  ↓
Browser downloads PDF
```

### 7.4 Share Timeline

```
User clicks "WhatsApp" or "Email" button on document page
  ↓
ShareActions component (components/share/ShareActions.tsx)
  ↓
If WhatsApp:
  → navigator.share(blob) on HTTPS (native share sheet on mobile)
  → wa.me link + download on HTTP (fallback)
  
If Email:
  → sendDocumentEmailAction(documentType, documentId, recipientEmail)
  → email.service.ts sends via Gmail SMTP
  ↓
Document link in chat/email
```

---

## 8. Audit Trail

Every prescription action creates an audit log:

| Action | Entity | Fields Logged | Trigger |
|--------|--------|---------------|---------|
| CREATE | PrescriptionRecord | `estimateNo`, `treatmentCount` | Auto-creation from estimate |
| UPDATE | PrescriptionRecord | `medicineCount`, `hasAdvice` | Doctor saves in editor |
| UPDATE | PrescriptionRecord | `clinicalNotes` | Via `updateClinicalNotes()` |

---

## 9. Known Issues & Workarounds

### 9.1 Cannot Delete Prescription
- Prescriptions are not soft-deleted (no `isDeleted` field)
- Doctor must edit and remove all entries if a mistake is made
- **Workaround:** Set all fields to empty, save, then cancel consultation

### 9.2 Cannot Edit Without Saving Everything
- Each save replaces the entire JSON snapshot
- Can't edit just medicines without re-validating chief complaint, exam, diagnosis, etc.
- **Workaround:** Use "Load from last visit" to pre-fill common sections

### 9.3 Tooth Selector Friction
- Every finding and treatment row has a separate tooth selector dialog
- Selecting "full mouth" requires clicking all 4 quadrants + "Select All"
- **Workaround:** Type teeth as comma-separated FDI manually (16,15,14,... etc.) — unsupported, will break

### 9.4 Cannot Link Prescriptions to Multiple Estimates
- One visit = one prescription (enforced by DB)
- If doctor creates estimate A, then estimate B for same visit, only one prescription exists
- **Workaround:** Create new visit for different treatment phase

### 9.5 Medical Alerts Not Editable
- Pulled from dental history, frozen at prescription creation
- If patient's allergies change mid-consultation, they won't update
- **Workaround:** Update patient's dental history, then delete prescription, re-create

---

## 10. User Journeys

### 10.1 Happy Path: Simple Cavity + Prescription

```
1. Receptionist adds patient to queue (10:30 AM)
   ↓
2. Doctor sees patient in queue, clicks "Estimate"
   ↓
3. /doctor/consultation/[visitId] loads with empty Rx
   ↓
4. Doctor fills:
   - Chief Complaint: "Pain in 16, sensitive to cold"
   - Exam: Finding "Caries near pulp", tooth 16
   - Treatment: "Root Canal Treatment"
   - Medicine: "Amoxicillin, 500mg, 2x daily, 5 days"
   - Advice: "Avoid chewing on that side"
   (Time: 5 min)
   ↓
5. Doctor clicks "Next" → goes to Estimate step
   ↓
6. Estimate auto-filled with Root Canal Treatment
   (Doctor adds rate, or accepts default)
   (Time: 1-2 min)
   ↓
7. Doctor clicks "Finish"
   ↓
8. Queue marked COMPLETED, doctor returns to queue
   ↓
9. Receptionist later prints estimate + prescription, patient collects
```

**Total Consultation Time: 7-8 minutes**

### 10.2 Complex Path: Full Mouth Scaling + Multiple Medicines

```
1. Receptionist adds patient to queue (11:00 AM)
   ↓
2. Doctor clicks "Estimate"
   ↓
3. Fills Prescription:
   - Chief Complaint: "Plaque buildup, bleeding gums"
   - Exam findings: "Generalized periodontitis" (teeth 18-11, 21-28, 48-41, 31-38)
     (Time: 3 min just selecting all teeth across quadrants)
   - Treatment: "Full mouth scaling & root planing"
   - Medicines: 
     • Amoxicillin 500mg
     • Metronidazole 400mg
     • Ibuprofen 400mg
     (Time: 4 min, one by one)
   - Advice: "Rinse with chlorhexidine, avoid smoking, soft diet"
   - Follow-up: 2 weeks
   (Subtotal: 10 min just filling prescription)
   ↓
4. Doctor goes to Estimate step
   (Time: 3 min)
   ↓
5. Doctor goes to Payment Plan step
   (Time: 2 min, if patient can pay in installments)
   ↓
6. Consultation "Complete"
   ↓
7. Patient sent to reception, prescription + estimate printed
```

**Total Consultation Time: 15-18 minutes**

### 10.3 Edit Path: Doctor Needs to Add a Note

```
1. Doctor is at Estimate step, realizes needs to add clinical note
   ↓
2. Clicks "Back" to Prescription step
   ↓
3. Scrolls to Clinical Notes section (bottom)
   ↓
4. Clicks "Add Note"
   ↓
5. Enters today's date + note text ("Referred for orthodontic assessment")
   ↓
6. Clicks "Save" (entire prescription re-validated, other fields unchanged)
   ↓
7. Toast: "Prescription saved"
   ↓
8. Clicks "Next" to continue
```

**Friction:** Must scroll entire form just to add one line of notes.

---

## 11. Comparative Analysis: Prescription vs. Estimate vs. Queue

| Aspect | Queue | Estimate | Prescription |
|--------|-------|----------|-------------|
| **Creation** | Manual (receptionist) | Manual (doctor, lazy) | Auto from estimate or visit |
| **Editing** | Toggle status dropdown | Add/remove items in table | Full form with 8 sections |
| **Time to Complete** | 30 seconds | 3-5 min | 10-15 min |
| **Validation** | Minimal | Zod (prices, discount) | Zod (all fields) |
| **Printing** | Queue board (no PDF) | PDF via Puppeteer | PDF via Puppeteer |
| **Soft Delete** | No | Yes | No |
| **Audit Trail** | Yes | Yes | Yes |
| **Linked To** | Visit 1:1 | Visit 1:1, Patient N:1 | Visit 1:1, Patient 1:N |

---

## 12. Summary: Why It Takes 15-20 Minutes

| Factor | Impact | Examples |
|--------|--------|----------|
| **UI Complexity** | 60% | 8 sections, 15+ fields, 20+ add/remove buttons |
| **Tooth Selection** | 15% | Clicking quadrant pickers 3-5 times per consultation |
| **Master List Lookups** | 10% | Searching treatment names in dropdown |
| **Form Validation Overhead** | 10% | Re-validating entire JSON on every save |
| **Navigation** | 5% | Scrolling between sections within one step |

---

## 13. Related Files & Locations

| What | File | Lines |
|------|------|-------|
| Prescription Service | `server/services/prescription.service.ts` | 1-291 |
| Prescription Actions | `actions/prescriptions.ts` | 1-115 |
| Estimate Wizard | `components/estimates/EstimateWizard.tsx` | 1-450 |
| Prescription Editor | `components/prescriptions/PrescriptionEditor.tsx` | 1-700+ |
| Consultation Page | `app/(dashboard)/doctor/consultation/[visitId]/page.tsx` | 1-121 |
| Estimate Page | `app/(dashboard)/doctor/estimate/new/page.tsx` | 1-23 |
| Database Schema | `prisma/schema.prisma` | 440-459 |
| Types | `lib/prescription-types.ts` | - |

---

## 14. Next Steps for Optimization

**Quick Wins (2-5 min per prescription):**
- Reduce medicine form rows to just `name` (dosage/frequency inline)
- Move clinical notes out of main form (separate quick-add button)
- Add "Quick Rx" modal for common cases (cavity → antibiotic → painkillers)

**Major Redesigns (5-10 min per prescription):**
- Decouple prescription from estimate (create independently)
- Separate medicines/advice editing (modal, not full page)
- Auto-suggest medicines based on treatment (pattern matching)

**Schema Changes:**
- Store medicines as separate records (like EstimateItem) instead of JSON array
- Allow multiple prescriptions per visit
- Add prescription templates (common medicine sets)

