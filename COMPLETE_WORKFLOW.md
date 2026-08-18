# Ur's Toothfully — Complete System Workflow

**Last Updated:** 2026-08-17  
**Status:** Full documentation of all user journeys and workflows  
**Scope:** Patient intake → consultation → payment → accounting export

---

## 1. System Overview & User Roles

### 1.1 Three User Roles

| Role | Default Path | Responsibilities | Access |
|------|--------------|------------------|--------|
| **RECEPTIONIST** | `/reception` | Patient registration, queue management, payment collection | Intake, search, queue board, payment screen, patient list |
| **DOCTOR** | `/doctor` | Patient consultation, prescription, estimate, treatment decisions | Queue, consultation wizard, patient history, prescriptions |
| **ADMIN** | `/admin` | System configuration, staff management, accounting, reports | Everything + treatments, users, accounting, Tally export, settings |

### 1.2 System Actors

```
┌─────────────────────────────────────────────────────────────┐
│                    TOOTHFULLY SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  PUBLIC (No Auth)              STAFF (Auth Required)         │
│  ├─ Kiosk Patient Intake      ├─ Receptionist              │
│  ├─ Appointment Booking       ├─ Doctor                    │
│  └─ Patient Portal            └─ Admin                     │
│                                                               │
│  INTEGRATIONS                                                │
│  ├─ Tally (Accounting Export)                              │
│  ├─ WhatsApp (Document Sharing)                            │
│  ├─ Gmail (Email Notifications)                            │
│  └─ Puppeteer (PDF Generation)                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Patient Journey (End-to-End)

### 2.1 Timeline: New Patient → Consultation → Payment → Closure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PATIENT COMPLETE JOURNEY                                  │
└─────────────────────────────────────────────────────────────────────────────┘

DAY 1: REGISTRATION & INTAKE (10-15 min)
├─ [PATIENT] Self-register at kiosk OR [RECEPTIONIST] enters staff form
│  └─ /intake (step 1) → /intake/dental-history (step 2) → /intake/success
│  └─ Time: 10-15 min (patient fills 50+ questions)
│
├─ System creates:
│  ├─ Patient (id, patientId: PAT-2026-XXXXX, profile, dental history v1)
│  ├─ Audit log (CREATE, Patient, createdById, createdAt)
│  └─ No queue entry yet (patient not visiting today)

DAY N: APPOINTMENT DAY (30-45 min total)
├─ [RECEPTIONIST] Checks patient in at queue
│  ├─ /reception (search + "Add to Queue" dialog)
│  ├─ Creates: PatientVisit + QueueEntry (status: WAITING)
│  └─ Time: 1-2 min
│
├─ [DOCTOR] Claims & examines patient
│  ├─ /doctor (queue board, clicks "Claim")
│  ├─ Status: WITH_DOCTOR
│  └─ Time: 15-20 min (examination)
│
├─ [DOCTOR] Documents consultation & proposes treatment
│  ├─ /doctor/consultation/[visitId] (3-step wizard)
│  ├─ Step 1: Prescription (chief complaint, exam, diagnosis, treatments, medicines, advice)
│  │  └─ Time: 10-15 min (BOTTLENECK)
│  ├─ Step 2: Estimate (line items, discount, advance required)
│  │  └─ Time: 2-3 min
│  ├─ Step 3: Payment Agreement (if multi-stage payment)
│  │  └─ Time: 1 min
│  ├─ Creates: PrescriptionRecord, Estimate, EstimateItems, PaymentAgreement
│  ├─ Audit log (CREATE estimate, CREATE prescription, CREATE agreement)
│  └─ Queue status → ESTIMATE_CREATED
│
├─ [RECEPTIONIST] Collects advance payment (if needed)
│  ├─ /reception/collect-payment (select visit, enter amount, mode)
│  ├─ Creates: Payment (CONSULTATION or ADVANCE), Receipt, AccountingEntry
│  ├─ Audit logs (CREATE payment, CREATE receipt, CREATE accounting entry)
│  ├─ Queue status → PAYMENT_PENDING or COMPLETED
│  └─ Time: 2-3 min
│
├─ [PATIENT] Receives documents
│  ├─ Estimate (printed or WhatsApp/email)
│  ├─ Receipt (for payment made)
│  ├─ Prescription (for medicines)
│  └─ (Optional) Appointment booking for follow-up

LATER: ACCOUNTING REVIEW & EXPORT (5-10 min, end of day/week)
├─ [ADMIN] Reviews pending accounting entries
│  ├─ /admin/accounting (list of PENDING_REVIEW entries)
│  ├─ Marks entries as APPROVED
│  └─ Time: 1-2 min per entry
│
├─ [ADMIN] Exports to Tally (end of week)
│  ├─ /admin/tally (review batch, download CSV/EXCEL)
│  ├─ Creates: ExportBatch, marks entries EXPORTED
│  ├─ Imports into Tally
│  └─ Time: 5-10 min

LATER: SUBSEQUENT VISITS (Follow-up treatment)
├─ Receptionist adds patient to queue again (same or different branch)
├─ Doctor can "Load from last visit" to copy previous prescription
├─ New prescription & estimate created
└─ Repeat payment flow
```

---

## 3. Role-Based Workflows

## 3.1 PUBLIC WORKFLOWS (No Authentication)

### 3.1.1 Workflow: Patient Self-Registration (Kiosk)

**Entry Point:** `GET /intake` (or kiosk tablet at clinic)

**Pages:**
1. `/intake` — Step 1: Personal Info
2. `/intake/dental-history` — Step 2: Medical & Dental History
3. `/intake/success` — Confirmation with Patient ID card

**Form Fields (Step 1):**
- Branch (dropdown)
- Full Name
- Date of Birth
- Gender
- Mobile
- Email
- Address
- Lead Source (Referral, Walk-in, Online, etc.)
- Reason for Visit (text)

**Form Fields (Step 2):**
- ~50 dental history questions:
  - Medical flags: Allergies, Diabetes, Epilepsy, Hepatitis, HIV, Heart problems, Blood pressure, Kidney/liver, Respiratory, Bleeds easily, Pregnant
  - Current medications
  - Dental history: Gum bleeding, Tooth loss, Sensitivity, Decay, Previous treatments
  - Tooth brushing habits, flossing, last check-up
  - Dental anxiety
  - Consent checkbox

**Actions:**
- `submitIntakeAction()` (Step 1) → Creates Patient + generates PAT-YYYY-XXXXX ID
- `submitIntakeDentalHistoryAction()` (Step 2) → Creates DentalHistory v1

**Output:**
- Displays `PAT-2026-00123` on success page (patient downloads/takes photo)
- No queue entry created yet (patient may visit later)

**Time:** 10-15 min

---

### 3.1.2 Workflow: Appointment Booking

**Entry Point:** `GET /book` (public calendar/scheduler)

**Pages:**
1. `/book` — Appointment form
2. `/book/success` — Confirmation

**Form Fields:**
- Patient ID (search or enter manually)
- Appointment date/time
- Branch
- Notes

**Actions:**
- `bookAppointmentAction()` → Creates Appointment record

**Output:**
- Confirmation with appointment details
- (Optional) WhatsApp/email reminder

**Time:** 2-3 min

---

## 3.2 RECEPTIONIST WORKFLOWS

### 3.2.1 Workflow: Patient Registration (Staff-Side Two-Step Wizard)

**Entry Point:** `/patients/new` (from Reception quick-action button)

**Pages:**
- `/patients/new` — Same as intake (personal info + dental history in one form)

**Difference from Public Intake:**
- No branch selection (receptionist's branch auto-selected)
- No lead source dropdown (receptionist can mark referral source)
- Slightly streamlined UI

**Actions:**
- `createPatientAction()` → Creates Patient + DentalHistory v1 atomically

**Time:** 5-8 min

---

### 3.2.2 Workflow: Reception Queue Management

**Entry Point:** `/reception` (live queue board)

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Reception Queue Board                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Quick Actions:                                      │
│  [+ New Patient] [🔍 Search] [💳 Collect Payment]  │
│                                                      │
│  WAITING (3 patients)                               │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Raj Patel (PAT-2026-00044)        [Claim]   │ │
│  │ Token #2 · Waiting 12 min                      │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Priya Singh (PAT-2026-00045)        [Claim]  │ │
│  │ Token #3 · Waiting 5 min                       │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  WITH_DOCTOR (2 patients)                           │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Amit Roy (PAT-2026-00043) with Dr. Sharma   │ │
│  │ Token #1 · With doctor 8 min                   │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ESTIMATE_CREATED (1 patient)                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Sneha Desai (PAT-2026-00042) with Dr. Patel │ │
│  │ Token #5 · Estimate ₹8,500 · Advance ₹1,700   │ │
│  │                         [💳 Collect Payment]    │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  COMPLETED / CANCELLED (shown in separate view)    │
│                                                      │
│  [🔄 Refresh every 10s] [⚙️ Settings]             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Sub-Workflow 3.2.2a: Add Patient to Queue**

**Entry:** Click "Add to Queue" button on patient search page or create new patient

**Dialog:**
- Patient name (auto-filled)
- Branch (receptionist's branch)
- Visit type (Consultation, Follow-up, Emergency)
- Doctor (optional, if assigned; else any available)

**Actions:**
- `addToQueueAction()` → Creates PatientVisit + QueueEntry (status: WAITING)
- Audit log (CREATE visit, CREATE queue entry)

**Time:** 1-2 min

---

**Sub-Workflow 3.2.2b: Refresh Queue & Monitor**

**Entry:** Auto-refresh every 10s (WebSocket or polling)

**Display Updates:**
- Queue status changes (WITH_DOCTOR, ESTIMATE_CREATED, PAYMENT_PENDING)
- Wait times
- Token numbers

**No action required** (receptionist monitors passively)

**Time:** 0 (passive)

---

### 3.2.3 Workflow: Payment Collection

**Entry Point:** `/reception/collect-payment` (from quick-action or ESTIMATE_CREATED queue card)

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Collect Payment                                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Patient: Raj Patel (PAT-2026-00044)                │
│  Visit: VISIT-2026-00098 · Dr. Sharma              │
│                                                      │
│  PAYMENT DETAILS:                                   │
│  ┌─────────────────────────────────────────────────┐
│  │ Consultation Fee:  ₹500                         │
│  │ Advance (20%):     ₹1,700                       │
│  │                    ─────────                    │
│  │ Due Now:           ₹2,200                       │
│  │                                                  │
│  │ Amount Entered:    [_____________]              │
│  │ Payment Mode:      [🔽 Cash ▼]                 │
│  │ Transaction Ref:   [_____________] (optional)   │
│  │                                                  │
│  │ [💳 Collect]  [Cancel]                         │
│  └─────────────────────────────────────────────────┘
│                                                      │
│  PAYMENT HISTORY:                                   │
│  • 2026-08-15 10:30 — Consultation ₹500 (Cash)     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Actions:**
- Select payment type (CONSULTATION, ADVANCE, TREATMENT, ADJUSTMENT)
- Enter amount (can be less than or equal to due)
- Select payment mode (CASH, UPI, CARD, BANK_TRANSFER)
- Optionally enter transaction reference (for UPI/bank)
- Click "Collect Payment"

**Server-Side:**
- `collectPaymentAction()` creates:
  - Payment record
  - Receipt (RCP-YYYY-XXXXX)
  - AccountingEntry (status: PENDING_REVIEW)
  - Audit log (CREATE payment, CREATE receipt)
- If payment type is TREATMENT or ADVANCE:
  - Queue status → PAYMENT_PENDING or COMPLETED
  - PatientVisit status updated

**Receipt Printing:**
- PDF generated on-the-fly via Puppeteer
- Receptionist can print immediately
- Patient can also receive via WhatsApp/email later

**Time:** 2-3 min

---

### 3.2.4 Workflow: Patient Search & History View

**Entry Point:** `/patients` (search all patients globally) or `/patients/[patientId]` (detailed view)

**Search Features:**
- By name (partial match)
- By mobile (exact or partial)
- By Patient ID (PAT-YYYY-XXXXX)
- Filters: branch, registration date range

**Patient Detail Page (`/patients/[patientId]`):**

```
┌─────────────────────────────────────────────────────┐
│  Raj Patel (PAT-2026-00044)          Edit · More    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  PROFILE TAB                                        │
│  ├─ Personal: Name, DOB, Gender, Mobile, Email     │
│  ├─ Address & Lead Source                          │
│  ├─ Medical Alerts (from dental history)           │
│  │  🔴 Consultation Fee Pending                     │
│  │  🟢 Consultation Paid                            │
│  └─ Emergency contact                              │
│                                                      │
│  TABS:                                              │
│  ├─ 📋 Visits (all visits with doctor, date)       │
│  ├─ 🦷 Dental History (view/edit)                  │
│  ├─ 📊 Estimates (all proposals with status)       │
│  ├─ 💳 Payments (all transactions)                 │
│  ├─ 📝 Clinical Notes (all notes from doctors)     │
│  ├─ 📈 Progress (treatment progress tracking)      │
│  ├─ 📄 Documents (prescriptions, receipts)         │
│  │  └─ Print | Share (WhatsApp/Email)              │
│  └─ 📞 Follow-up Appointments (booked)             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Actions Available:**
- Edit patient profile
- Add to queue (from this page)
- View/download any document
- Share documents
- Print receipts/prescriptions
- Schedule follow-up

**Time:** 2-5 min (depends on scope)

---

## 3.3 DOCTOR WORKFLOWS

### 3.3.1 Workflow: Doctor's Queue & Patient Assignment

**Entry Point:** `/doctor` (doctor's personal queue board)

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Dr. Sharma's Queue · Outram Branch                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│  TODAY'S PATIENTS (6 assigned to you)               │
│                                                      │
│  ASSIGNED TO YOU:                                   │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Raj Patel (PAT-2026-00044)                   │ │
│  │ Waiting 15 min · Consultation                  │ │
│  │ Chief complaint: Pain in lower left             │ │
│  │         [📋 Start Consultation]  [📞 Call]     │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Priya Singh (PAT-2026-00045) · Follow-up    │ │
│  │ Waiting 8 min                                  │ │
│  │ Last visit: 2026-07-20 (Root canal follow-up) │ │
│  │         [📋 Continue Treatment]                │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  WAITING (other doctors' patients):                 │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🏥 Amit Roy (PAT-2026-00043) · Dr. Patel      │ │
│  │ Waiting 3 min                                  │ │
│  │         [Claim Patient]                        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  RECENT CONSULTATIONS (today):                      │
│  • Sneha Desai (estimate ₹8,500)                   │
│  • Vikram Singh (estimate ₹3,200)                  │
│  • Anjali Sharma (prescription only)                │
│                                                      │
│  [⚙️ Settings]  [📊 Reports]                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Sub-Workflow 3.3.1a: Claim Unassigned Patient**

**Entry:** Click "Claim Patient" on any WAITING queue entry not assigned to doctor

**Action:**
- `claimQueueAction()` → Sets QueueEntry.doctorId = current doctor, status → WITH_DOCTOR
- Audit log (CLAIM, queue entry)

**Result:**
- Queue entry moves to "ASSIGNED TO YOU" section
- Doctor can now proceed with consultation

**Time:** <1 min

---

### 3.3.2 Workflow: Patient Consultation (The 3-Step Wizard)

**Entry Point:** Click "Start Consultation" on doctor's queue → `/doctor/consultation/[visitId]`

**Pages Involved:**

1. **Step 1: Prescription** (PrescriptionEditor component)
   - Chief Complaint
   - On Examination (findings + tooth selector + templates)
   - Diagnosis
   - Treatment Plan (treatments with tooth numbers)
   - Medicines (editable table)
   - Advice
   - Follow-up Date
   - Clinical Notes

2. **Step 2: Estimate** (EstimateBuilder component)
   - Treatments auto-filled from Step 1
   - Add/edit line items (rate, quantity, planned sittings)
   - Discount (%) and total
   - Advance required (calculated from settings)

3. **Step 3: Payment Plan** (PaymentAgreementCard component)
   - Payment stages (e.g., 50% now, 50% after treatment)
   - Clinic representative signature
   - Patient acceptance (checkbox)

**Data Model During Wizard:**

```typescript
interface EstimateWizardState {
  step: number                           // 1, 2, or 3
  currentEstimateId: string | null       // Created on Step 2 save
  liveTreatments: PrescriptionTreatment[] // Live from Step 1
  
  // Step 1 state
  chiefComplaint: string
  onExamination: ExaminationFinding[]
  diagnosis: string
  treatmentPlan: PrescriptionTreatment[]
  medicines: PrescriptionMedicine[]
  advice: string
  followUpDate: string
  clinicalNotes: ClinicalNoteEntry[]
  
  // Step 2 state
  estimateItems: EstimateItem[]          // Auto-derived from treatmentPlan
  estimateNotes: string
  estimateDiscount: number
  
  // Step 3 state
  paymentStages: PaymentStage[]
}
```

**Timeline:**

```
Time    Action                       Component         Data Created
─────────────────────────────────────────────────────────────────────
0 min   Doctor clicks "Start"        EstimateWizard    (loads)
        consultation
        
        Loads Step 1: Prescription   PrescriptionEditor
        
1-15    Doctor fills:
min     • Chief complaint (1 min)
        • Exam findings (4 min)       
        • Diagnosis (1 min)
        • Treatments (3 min)          [AUTO-CREATE]
        • Medicines (5 min)           PrescriptionRecord
        • Advice (1 min)
        
        Doctor clicks "Next" →
        
16 min  Estimates Step 2             EstimateBuilder   [AUTO-CREATE]
        Treatments auto-filled from   Estimate
        prescription                  EstimateItems
        
        Doctor adds rates/quantity
        Reviews total & advance (2-3 min)
        
        Doctor clicks "Next" →
        
19 min  Payment Plan Step 3          PaymentAgreement  [CREATE if multi-stage]
        (if applicable)              Card
        
        Doctor clicks "Finish" →
        
20 min  Consultation complete!       updateQueueStatus COMPLETED
        Queue entry status → COMPLETED
        PatientVisit status → COMPLETED
```

**Actions Triggered:**

1. **Auto on Prescription Load:**
   - `prescriptionService.ensureForVisit()` creates PrescriptionRecord if missing

2. **On "Next" from Step 1:**
   - `updatePrescriptionAction()` saves all prescription data
   - `onTreatmentsChange()` callback updates liveTreatments for estimate

3. **On "Next" from Step 2:**
   - `createEstimateAction()` creates Estimate + EstimateItems
   - Auto-calls `prescriptionService.createFromEstimate()` (if not already created)
   - Creates audit logs

4. **On "Finish":**
   - `paymentAgreementService.save()` (if payment plan filled)
   - `updateQueueStatusAction(queueId, "COMPLETED")` marks queue entry done
   - Toast: "Consultation completed"
   - Redirect to `/doctor`

**Time:** 15-20 min (MAJOR BOTTLENECK)

---

### 3.3.3 Workflow: Review Patient History & Documents

**Entry Point:** Search patient → Click patient name → View tabs

**Available Tabs:**

| Tab | Shows | Actions |
|-----|-------|---------|
| **Visits** | All past visits with doctor + date | Click to view details |
| **Dental History** | Current medical & dental history | Edit (if ADMIN/RECEPTIONIST) |
| **Estimates** | All treatment proposals | View, print, cancel if needed |
| **Payments** | All transactions | View receipt |
| **Clinical Notes** | Dated notes from all doctors | View |
| **Documents** | Prescriptions, receipts, estimates | Print, WhatsApp, Email |
| **Progress** | Treatment completion tracking | Visual timeline |
| **Follow-ups** | Scheduled appointments | Reschedule/cancel |

**Common Doctor Action:** "Load from last visit"
- Doctor can click button on any past visit
- Loads previous prescription (complaint, findings, treatments, medicines, advice)
- Auto-filled into current consultation
- Doctor edits as needed

**Time:** 2-5 min

---

## 3.4 ADMIN WORKFLOWS

### 3.4.1 Workflow: Accounting Review & Approval

**Entry Point:** `/admin/accounting`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Accounting Entries · All Branches                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Filter:  [All Statuses ▼]  [All Branches ▼]       │
│                                                      │
│  PENDING_REVIEW (8 entries)                         │
│  ┌────────────────────────────────────────────────┐ │
│  │ 2026-08-17 · Raj Patel (PAT-00044)             │ │
│  │ Consultation Fee · ₹500 (Cash)                 │ │
│  │ Payment: RCP-2026-00087 · Outram Branch        │ │
│  │                    [✓ Approve] [⊗ Reject]     │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ 2026-08-17 · Priya Singh (PAT-00045)           │ │
│  │ Advance (20%) · ₹1,700 (UPI)                   │ │
│  │ Est: EST-2026-00012 · New Alipore Branch       │ │
│  │                    [✓ Approve] [⊗ Reject]     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  APPROVED (23 entries)                              │
│  [Show approved entries]                            │
│                                                      │
│  EXPORTED (145 entries) [To Tally]                 │
│  [Show exported entries]                            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Sub-Workflow 3.4.1a: Review & Approve Payment**

**Entry:** Click [Approve] on a PENDING_REVIEW entry

**Action:**
- `approveEntryAction(entryId)` → AccountingEntry.status = APPROVED
- Audit log (APPROVE, accounting entry)

**Result:**
- Entry moves to APPROVED section
- Ready for export to Tally

**Time:** <1 min (per entry)

---

### 3.4.2 Workflow: Tally Export (Accounting Batch)

**Entry Point:** `/admin/tally`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Tally Export · Batch Management                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  APPROVED ENTRIES (23 ready to export)              │
│                                                      │
│  Summary:                                            │
│  • Total Amount: ₹47,200                           │
│  • Entries: 23 (17 receipts, 4 advances, 2 adj.)   │
│  • Date Range: 2026-08-10 to 2026-08-17           │
│  • Branches: Outram (12), Alipore (8), Salt Lake (3) │
│                                                      │
│  Export Format:  [CSV ▼]  [EXCEL]                 │
│                                                      │
│  [📥 Download Batch]                               │
│                                                      │
│  ───────────────────────────────────────────────    │
│                                                      │
│  RECENT EXPORTS:                                    │
│  • EXP-2026-00015 · 2026-08-17 · 23 entries       │
│  • EXP-2026-00014 · 2026-08-10 · 31 entries       │
│  • EXP-2026-00013 · 2026-08-03 · 18 entries       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Sub-Workflow 3.4.2a: Export Batch**

**Entry:** Click [Download Batch] button

**Server-Side:**
- `exportTallyAction()` creates:
  - ExportBatch (EXP-YYYY-XXXXX)
  - Marks all selected entries as EXPORTED
  - Generates CSV or EXCEL file
  - Creates audit log (EXPORT, ExportBatch)

**Output:**
- CSV/EXCEL file downloaded
- Admin imports into Tally accounting software
- Reconcile with bank statements

**Time:** 5-10 min (including export, import, reconcile)

---

### 3.4.3 Workflow: Reports & Analytics

**Entry Point:** `/admin/reports`

**Available Reports:**

```
Reports Dashboard
├─ Daily Report (/daily)
│  ├─ Collections by branch (today)
│  ├─ Payment mode breakdown (cash, UPI, card)
│  ├─ Consultation vs. treatment vs. advance
│  └─ Top 5 treatments performed
│
├─ Monthly Report (/monthly)
│  ├─ Revenue trend (month-over-month)
│  ├─ Patient acquisition
│  ├─ Conversion (consultation → treatment)
│  └─ Outstanding balances
│
├─ Doctor Metrics (/doctor)
│  ├─ Collections per doctor
│  ├─ Patient count per doctor
│  ├─ Average treatment value
│  └─ Prescription patterns
│
├─ Treatment Analytics (/treatment)
│  ├─ Most common procedures
│  ├─ Revenue per procedure
│  ├─ Estimated vs. actual completion rate
│  └─ Tooth location heatmap
│
├─ Lead Source Report (/lead-source)
│  ├─ New patients by source (referral, walk-in, online)
│  ├─ Conversion rate per source
│  └─ Cost per acquisition (if integrated)
│
└─ Outstanding Balances (/outstanding)
   ├─ Patients with pending payment
   ├─ Amount owed per patient
   ├─ Overdue count
   └─ Collection priority list
```

**No Actions Required** (read-only dashboards with charts)

**Time:** 5-10 min to review

---

### 3.4.4 Workflow: Treatment Master Management

**Entry Point:** `/admin/treatments`

**CRUD Operations:**

| Action | UI | Time |
|--------|----|----|
| **List** | View all treatments with status | Passive |
| **Create** | Form: category, name, default amount | 2 min |
| **Edit** | Update price or category | 1 min |
| **Soft Delete** | Mark as inactive | <1 min |

**Purpose:**
- Treatments are shown in doctor's dropdown when building estimate
- Default prices auto-fill (doctor can override)
- Categories used for filtering

**Data Used By:**
- EstimateBuilder (treatment dropdown)
- PrescriptionEditor (treatment plan dropdown)
- Reports (treatment analytics)

**Time:** 10-20 min (setup, then minimal maintenance)

---

### 3.4.5 Workflow: Staff Management (Users)

**Entry Point:** `/admin/users`

**CRUD Operations:**

| Field | Type | Notes |
|-------|------|-------|
| Name | Text | Full name |
| Email | Text | Login email |
| Password | Password | Initial; doctor can reset |
| Role | Dropdown | RECEPTIONIST, DOCTOR, ADMIN |
| Branch | Dropdown | Home branch (doctors assigned) |
| Doctor Reg No | Text | Registration number (doctors only) |
| Qualifications | Text | Degrees/certifications (doctors) |
| Status | Toggle | Active/inactive |

**Role Permissions:**
- RECEPTIONIST → `/reception`, `/patients`, `/payments`
- DOCTOR → `/doctor`, `/consultation`, patient history
- ADMIN → Everything

**Time:** 5 min per user

---

### 3.4.6 Workflow: Branch & Settings

**Entry Point:** `/admin/settings`

**Configurable Settings:**

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `advance_percent` | Number | 20 | Advance as % of treatment cost |
| `consultation_fee` | Number | 500 | Fixed consultation charge |
| `allow_discount` | Bool | true | Allow discounts on estimates |
| `sms_enabled` | Bool | false | Send SMS reminders (unused) |
| `whatsapp_enabled` | Bool | true | Enable WhatsApp sharing |

**Per-Branch Settings:**
- Settings can be global or per-branch
- Receptionist's branch used for payment screens
- Doctor's branch for defaults (can override)

**Time:** 5-10 min (one-time setup)

---

## 4. Data Dependencies & Workflows

### 4.1 Entity Relationship Flow

```
┌─────────────┐
│  Patient    │ ← Auto-created at /intake or /patients/new
└──────┬──────┘
       │
       ├─→ DentalHistory (v1, isLatest=true)
       │   ├─ Medical alerts
       │   ├─ Dental conditions
       │   └─ (Updated if staff edits)
       │
       ├─→ PatientVisit (1 per appointment)
       │   ├─ visitNo (VISIT-YYYY-XXXXX)
       │   ├─ doctorId (assigned or claimed)
       │   ├─ branchId (clinic location)
       │   └─ chiefComplaint (optional)
       │
       ├─→ QueueEntry (1:1 with PatientVisit)
       │   ├─ status (WAITING → WITH_DOCTOR → ESTIMATE_CREATED → COMPLETED)
       │   ├─ tokenNumber (clinic queue order)
       │   └─ timestamps (sentAt, claimedAt, completedAt)
       │
       ├─→ Appointment (optional, for follow-up)
       │   ├─ appointmentDate
       │   └─ notes
       │
       ├─→ PrescriptionRecord (1:1 with PatientVisit)
       │   ├─ prescriptionData (JSON snapshot)
       │   ├─ mode (PRINT_ONLY, PARTIAL_DIGITAL, FULL_DIGITAL)
       │   └─ medicines, advice, treatments (stored in JSON)
       │
       ├─→ Estimate (optional, 1:1 with PatientVisit)
       │   ├─ estimateNo (EST-YYYY-XXXXX)
       │   ├─ subtotal, total, advanceRequired
       │   ├─ status (DRAFT → ACTIVE → COMPLETED)
       │   │
       │   └─→ EstimateItem (N items per estimate)
       │       ├─ treatmentId (link to TreatmentMaster)
       │       ├─ treatmentName, category, toothNumber
       │       ├─ quantity, unitRate, amount
       │       └─ status (PENDING → IN_PROGRESS → COMPLETED)
       │
       ├─→ Payment (N payments per patient)
       │   ├─ paymentType (CONSULTATION, TREATMENT, ADVANCE, ADJUSTMENT)
       │   ├─ amount (Decimal)
       │   ├─ mode (CASH, UPI, CARD, BANK_TRANSFER)
       │   ├─ transactionRef (UPI/bank only)
       │   └─ collectedById (receptionist)
       │
       ├─→ Receipt (1:1 with Payment)
       │   ├─ receiptNo (RCP-YYYY-XXXXX)
       │   └─ issuedById (receptionist)
       │
       ├─→ ClinicalNote (N notes per visit)
       │   ├─ noteType (e.g., "EXAMINATION", "FOLLOW_UP")
       │   ├─ content (text)
       │   ├─ toothNumbers (FDI string)
       │   └─ doctorId
       │
       ├─→ AccountingEntry (1:1 with Payment)
       │   ├─ status (PENDING_REVIEW → APPROVED → EXPORTED)
       │   ├─ entryDate, amount, paymentMode, paymentType
       │   ├─ exportBatchId (if exported)
       │   └─ branchId
       │
       └─→ AuditLog (N logs for all changes)
           ├─ entityType, entityId, action
           ├─ changedById, changedAt
           └─ previousValues, newValues (for updates)
```

---

### 4.2 Workflow Dependencies

```
PATIENT REGISTRATION
        ↓
        Creates: Patient + DentalHistory
        ↓
QUEUE ENTRY (Receptionist adds to queue)
        ↓
        Creates: PatientVisit + QueueEntry
        ↓
DOCTOR CONSULTATION
        ↓
        Loads/Creates: PrescriptionRecord (Step 1)
        Creates: Estimate (Step 2)
        Creates: EstimateItems
        ↓
PAYMENT COLLECTION
        ↓
        Creates: Payment + Receipt + AccountingEntry
        Updates: QueueEntry status
        ↓
ACCOUNTING REVIEW
        ↓
        Approves: AccountingEntry
        ↓
TALLY EXPORT
        ↓
        Creates: ExportBatch
        Updates: AccountingEntry (EXPORTED)
        ↓
REPORTS
        ↓
        Aggregates: Payments, Estimates, Patients
```

---

## 5. Time Analysis: Where Does Time Go?

### 5.1 Complete Patient Visit Timeline

```
Activity                    Participant      Duration    Cumulative
─────────────────────────────────────────────────────────────────
1. Receptionist checks in   RECEPTIONIST     1-2 min     1-2 min
   (search + add to queue)

2. Patient in waiting room  (waiting)        5-15 min    6-17 min

3. Doctor examination       DOCTOR           15-20 min   21-37 min
   (no documentation yet)

4. Prescription filling     DOCTOR           10-15 min   31-52 min  ← BOTTLENECK
   (8 sections, many fields)

5. Estimate review/edit     DOCTOR           2-3 min     33-55 min

6. Payment plan (if any)    DOCTOR           1 min       34-56 min

7. Receptionist collects    RECEPTIONIST     2-3 min     36-59 min
   payment

8. Patient leaves           (time)           0 min       36-59 min

TOTAL VISIT TIME:                            ~45-60 min per patient
```

### 5.2 Pain Points by Time

| Pain Point | Time Cost | Frequency | Solution Type |
|-----------|-----------|-----------|-----------------|
| Tooth selector (7 clicks avg) | 3 min | Every consultation | UI simplification |
| Treatment master lookup (searching dropdown) | 2 min | 3-5 times per consultation | Auto-suggest/templates |
| Scrolling between form sections | 1 min | Multiple times | Modal/drawer vs. page |
| Validating entire form on save | 1 min | Each save | Incremental save |
| Adding medicines one-by-one | 3-5 min | Every consultation | Template medicine sets |
| Filling 50+ dental history questions | 10-15 min | First visit only | Pre-fill / skip optional |
| Re-editing after doctor note addition | 2-3 min | If needed | Separate quick-add button |

### 5.3 Workflow Efficiency Metric

```
Total Clinic Time: ~45-60 min per patient
Doctor Active Time: ~25-30 min (examination + documentation)
Receptionist Time: ~3-5 min
Waiting/Overhead: ~15-20 min

BOTTLENECK: Prescription documentation
  - Takes 40-50% of doctor's time
  - Involves 8 sections and 15+ fields
  - Repeated saves with full validation
  - No quick shortcuts for common cases
```

---

## 6. System Integrations & Side Flows

### 6.1 PDF Generation (Puppeteer)

**Triggered:** When patient views or prints estimate/receipt/prescription

**Flow:**
```
User clicks "Print" or "Download PDF"
  ↓
GET /api/documents/[type]/[id]/pdf
  ↓
Server spawns Puppeteer headless browser
  ↓
Renders /print/[type]/[id] page
  (page reads data from DB and formats for A4)
  ↓
Puppeteer generates PDF
  ↓
Saves to generated-documents/ (gitignored)
  ↓
Browser downloads PDF
```

**Time:** 2-3 seconds per PDF

**Types Supported:**
- Estimate (/print/estimate/[estimateId])
- Receipt (/print/receipt/[receiptId])
- Prescription (/print/prescription/[visitId])

---

### 6.2 Document Sharing (WhatsApp / Email)

**Entry Point:** "Share" button on estimate/receipt/prescription page

**WhatsApp Flow:**
```
User clicks "Share via WhatsApp"
  ↓
IF HTTPS (tablet at clinic):
  → navigator.share(PDF blob)
  → Native share sheet opens
  → User selects WhatsApp contact
  → PDF sent as message
  
IF HTTP (desktop / dev):
  → wa.me link + download prompt
  → User manually sends PDF
```

**Email Flow:**
```
User clicks "Share via Email"
  ↓
Opens modal: Enter recipient email
  ↓
sendDocumentEmailAction()
  ↓
email.service.ts (Nodemailer)
  ↓
Generates/attaches PDF
  ↓
Sends via Gmail SMTP
  (SMTP_USER, SMTP_APP_PASSWORD from .env)
  ↓
Patient receives email with PDF
```

**Time:** 1-2 min

---

### 6.3 WhatsApp Cloud API Integration (Future)

**Current:** Manual download + send via wa.me or WhatsApp Web

**Planned:** Automated Cloud API for bulk sends
```
WHATSAPP_PROVIDER=cloud-api
↓
Implements CloudApiWhatsAppProvider
↓
Auto-sends prescriptions + receipts when created
↓
Patient receives immediately
```

**Time:** <1 sec (automated)

---

## 7. Complexity Factors Across System

### 7.1 Form Complexity

| Form | Fields | Sections | Validations | Time (min) |
|------|--------|----------|------------|-----------|
| Intake (Patient) | 9 | 1 | Basic | 2 |
| Dental History | 50+ | 8 | Medical flags + details | 10-15 |
| Patient Registration (Staff) | 60 | 2 | Merged form | 5-8 |
| Prescription Editor | 15+ | 8 | Complex Zod schema | 10-15 |
| Estimate Builder | 8 (per item) | 1 | Prices, discount | 2-3 min per item |
| Payment Collection | 4 | 1 | Mode-dependent validation | 2-3 |

### 7.2 Page Hierarchy Complexity

```
PUBLIC PAGES (3 pages, no auth)
├─ /intake (Step 1)
├─ /intake/dental-history (Step 2)
└─ /intake/success

RECEPTIONIST PAGES (8 pages)
├─ /reception (queue board)
├─ /reception/collect-payment
├─ /patients (search)
├─ /patients/new (registration)
├─ /patients/[patientId] (detail + 8 tabs)
│  ├─ Profile
│  ├─ Visits
│  ├─ Dental History
│  ├─ Estimates
│  ├─ Payments
│  ├─ Clinical Notes
│  ├─ Progress
│  └─ Documents
└─ /appointments (bookings)

DOCTOR PAGES (5+ pages)
├─ /doctor (queue)
├─ /doctor/consultation/[visitId] (3-step wizard)
│  ├─ Step 1: PrescriptionEditor
│  ├─ Step 2: EstimateBuilder
│  └─ Step 3: PaymentAgreement
├─ /doctor/prescription/[prescriptionId] (detail view)
├─ /patients/[patientId] (same as receptionist)
└─ /print/prescription/[visitId]

ADMIN PAGES (12+ pages)
├─ /admin (dashboard)
├─ /admin/users
├─ /admin/treatments
├─ /admin/settings
├─ /admin/availability
├─ /admin/accounting
├─ /admin/tally
├─ /admin/audit
├─ /admin/reports
│  ├─ /daily
│  ├─ /monthly
│  ├─ /doctor
│  ├─ /treatment
│  ├─ /lead-source
│  └─ /outstanding
└─ /print/* (PDF views)

PRINT PAGES (3 pages, hidden)
├─ /print/estimate/[estimateId]
├─ /print/receipt/[receiptId]
└─ /print/prescription/[visitId]
```

### 7.3 Component Complexity

| Component | Nesting | State Vars | Re-renders | Complexity |
|-----------|---------|-----------|-----------|-----------|
| EstimateWizard | Deep (3 sub-components) | 8+ | Step changes | High |
| PrescriptionEditor | 8 sections | 10+ | Every field change | Very High |
| EstimateBuilder | 1-5+ items | 5+ | Item add/remove | High |
| QueueBoard | Dynamic list | 3+ | Auto-refresh every 10s | High |
| PaymentAgreementCard | Modal + form | 4+ | Stage add/remove | Medium |
| ToothSelector | Dialog + grid | 2+ | Quadrant selection | Medium |

---

## 8. Database Schema Complexity

### 8.1 Entity Count

```
Core Models:
  Patient, User, Branch → Users & Patients
  PatientVisit, QueueEntry → Queue Management
  DentalHistory → Medical Records
  Estimate, EstimateItem → Billing
  Payment, Receipt → Revenue
  PrescriptionRecord → Clinical Docs
  ClinicalNote → Doctor Notes
  AccountingEntry, ExportBatch → Accounting
  AuditLog → Audit Trail
  TreatmentMaster → Treatment Library
  Appointment → Scheduling
  DoctorAvailability → Scheduling
  SystemSetting → Configuration

Total: 15+ core models
```

### 8.2 Index Strategy

```
Patient: index on (mobile), (patientId), (registrationBranchId)
QueueEntry: index on (visitId), (branchId), (status), (sentAt)
PrescriptionRecord: index on (patientId, createdAt), (visitId)
Estimate: index on (visitId), (patientId), (status)
Payment: index on (patientId), (estimateId), (paymentType), (paymentDate)
AccountingEntry: index on (status), (branchId), (entryDate), (exportBatchId)
AuditLog: index on (entityType, entityId), (changedAt), (changedById)
```

---

## 9. Known Workflow Gaps & Friction

### 9.1 Prescription-Only Consultation (No Treatment)

**Gap:** If doctor doesn't create an estimate (e.g., just advice), the wizard seems incomplete.

**Workaround:** Skip Step 2/3 buttons, click "Finish" from Step 1 (Rx-only completion)

**Impact:** Confusing UX; users think they missed a step

---

### 9.2 Cannot Partially Fill Visit

**Gap:** All form sections must be valid to save (Zod validation on entire schema).

**Workaround:** Fill minimum required fields (chief complaint + at least one medicine)

**Impact:** Doctor can't save incomplete work; must finish in one session

---

### 9.3 Cross-Branch Doctor Assignment

**Gap:** Doctor has a home `branchId`, but can be assigned to any branch.

**Logic:** Must check `entry.doctorId === session.userId`, not `entry.branchId === session.branchId`

**Impact:** Requires special auth rules in multiple places; easy to miss

---

### 9.4 Soft Delete Inconsistency

**Gap:** Some models are soft-deleted (Patient, Estimate, Payment), others aren't (PrescriptionRecord).

**Impact:** Can't recover deleted prescriptions; must create new one

---

### 9.5 One Prescription Per Visit

**Gap:** If doctor creates Estimate A, then decides to create Estimate B for same visit, only one Rx exists.

**Workaround:** Create new visit for second treatment phase

**Impact:** Multi-phase treatment workflows are clunky

---

## 10. Summary: Complete Workflow Complexity

### 10.1 Scope

```
PUBLIC:     2 workflows (self-registration, appointment booking)
RECEPTIONIST: 5 workflows (registration, queue, payment, search, patient detail)
DOCTOR:     3 workflows (queue, consultation, patient history)
ADMIN:      6 workflows (accounting, Tally, reports, staff, treatments, settings)

TOTAL:      16+ workflows
```

### 10.2 Average Times

```
Patient Registration (first visit):    10-15 min
Patient Check-in (receptionist):       1-2 min
Doctor Examination:                    15-20 min
Prescription Documentation:            10-15 min (BOTTLENECK)
Estimate Review:                       2-3 min
Payment Collection:                    2-3 min
Accounting Review:                     1 min per entry
Tally Export:                          5-10 min

Total Patient Visit:                   45-60 min
Doctor Active Time:                    25-30 min
Receptionist Time:                     5-10 min
```

### 10.3 Data Entities Created per Visit

```
Per Patient Registration:
  ✓ Patient
  ✓ DentalHistory v1
  
Per Queue Entry:
  ✓ PatientVisit
  ✓ QueueEntry
  ✓ AuditLog (2x)
  
Per Consultation:
  ✓ PrescriptionRecord
  ✓ Estimate
  ✓ EstimateItem (N items)
  ✓ AuditLog (3x)
  
Per Payment:
  ✓ Payment
  ✓ Receipt
  ✓ AccountingEntry
  ✓ AuditLog (3x)
  
Per Accounting Export:
  ✓ ExportBatch
  ✓ Update N AccountingEntries (EXPORTED)
  ✓ AuditLog
  
PER PATIENT VISIT: ~15-20 database records created
MULTIPLIED BY 100+ PATIENTS/DAY: Significant write load
```

---

## 11. Critical Path for Optimization

### 11.1 Biggest Time Sinks (By Impact)

| Rank | Issue | Time | Fix Type | Effort |
|------|-------|------|----------|--------|
| 1 | Prescription form (8 sections) | 10-15 min | Modularize → modal | Medium |
| 2 | Tooth selector (7+ clicks) | 3 min | Bulk select → keyboard | Small |
| 3 | Master treatment lookup | 2 min | Auto-suggest / templates | Small |
| 4 | Full form validation on save | 1 min | Incremental save | Medium |
| 5 | Dental history (50 questions) | 10-15 min | Condense/skip optional | Small |

### 11.2 Quick Wins (2-5 min per visit)

1. **Reduce tooth selector friction:** Bulk keyboard shortcuts (e.g., "fa" = full arch)
2. **Auto-suggest medicines:** Based on treatment + common patterns
3. **Condense dental history:** Group optional questions, default to "No"
4. **Move clinical notes:** Separate quick-add button (not in main form)

### 11.3 Major Redesigns (5-10 min per visit)

1. **Decouple prescription & estimate:** Create independently, not in wizard
2. **Modal-based prescription:** Quick edit, not 3-step wizard
3. **Templates for common cases:** "Simple cavity" → pre-filled form
4. **Separate data entry:** Examination first, prescription second

---

## 12. File Locations

| Workflow | Key Files |
|----------|-----------|
| Patient Intake | `/app/(public)/intake/page.tsx`, `actions/intake.ts`, `services/patient.service.ts` |
| Reception Queue | `/app/(dashboard)/reception/page.tsx`, `app/api/queue/` |
| Doctor Consultation | `/app/(dashboard)/doctor/consultation/[visitId]/page.tsx`, `components/estimates/EstimateWizard.tsx` |
| Prescription | `server/services/prescription.service.ts`, `components/prescriptions/PrescriptionEditor.tsx` |
| Payment | `/app/(dashboard)/reception/collect-payment/page.tsx`, `server/services/payment.service.ts` |
| Accounting | `/app/(dashboard)/admin/accounting/page.tsx`, `server/services/accounting.service.ts` |
| Reports | `/app/(dashboard)/admin/reports/`, `server/repositories/` (query builders) |
| Audit | `lib/audit.ts`, `server/repositories/audit.repository.ts` |

