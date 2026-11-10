/**
 * Per-user access restrictions. An admin can switch OFF any feature a user's
 * role normally has; nothing here grants more than the role allows. Stored on
 * User.permissions as overrides ({ key: false }); null/missing = full access,
 * so every existing user keeps exactly today's behaviour.
 *
 * Pure module (no server imports) — used by pages, APIs, actions and the
 * admin UI alike.
 */

export type Role = "ADMIN" | "DOCTOR" | "RECEPTIONIST"

export const PERMISSIONS = {
  allPatients: {
    label: "See all patients",
    help: "Off: only today's patients — their own appointments and queue patients for a doctor, today's appointments and queue for reception.",
    roles: ["DOCTOR", "RECEPTIONIST"],
  },
  prices: {
    label: "See prices",
    help: "Treatment prices, estimates, invoices and the patient's balance.",
    roles: ["DOCTOR", "RECEPTIONIST"],
  },
  payments: {
    label: "See payment history",
    help: "Payments tab, receipts and amounts paid.",
    roles: ["DOCTOR", "RECEPTIONIST"],
  },
  estimates: {
    label: "Create and edit estimates",
    help: "Needs “See prices”. Off: the consultation finishes after the prescription.",
    roles: ["DOCTOR"],
  },
  prescriptions: {
    label: "Write prescriptions",
    help: "Prescriptions and the consultation screen.",
    roles: ["DOCTOR"],
  },
  clinicalNotes: {
    label: "Clinical notes",
    help: "Read and write clinical notes.",
    roles: ["DOCTOR"],
  },
  documents: {
    label: "Patient documents",
    help: "X-rays, reports and uploaded files.",
    roles: ["DOCTOR", "RECEPTIONIST"],
  },
  editPatients: {
    label: "Register and edit patients",
    help: "New patient registration and editing patient details.",
    roles: ["RECEPTIONIST"],
  },
  collectPayments: {
    label: "Collect payments and bill",
    help: "Needs “See prices”. Collect payment, bill products, create invoices.",
    roles: ["RECEPTIONIST"],
  },
  queue: {
    label: "Manage the live queue",
    help: "Add patients to the queue and run the reception queue.",
    roles: ["RECEPTIONIST"],
  },
  appointments: {
    label: "Appointments",
    help: "Doctor: see the appointments calendar. Reception: book, reschedule and cancel.",
    roles: ["DOCTOR", "RECEPTIONIST"],
  },
  whatsapp: {
    label: "WhatsApp",
    help: "WhatsApp inbox, messages and templates.",
    roles: ["RECEPTIONIST"],
  },
} as const satisfies Record<string, { label: string; help: string; roles: readonly Role[] }>

export type PermissionKey = keyof typeof PERMISSIONS
export type Perms = Record<PermissionKey, boolean>
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[]

/** Ready-made scenarios. `off` lists what the scenario switches off. */
export const PRESETS: Record<"DOCTOR" | "RECEPTIONIST", { id: string; label: string; help: string; off: PermissionKey[] }[]> = {
  DOCTOR: [
    { id: "full", label: "Full access (default)", help: "Everything a doctor can do today.", off: [] },
    {
      id: "rx-only",
      label: "Prescriptions only — today's patients",
      help: "Sees only today's patients, writes prescriptions. No prices, payments, estimates, notes or documents.",
      off: ["allPatients", "prices", "payments", "estimates", "clinicalNotes", "documents", "appointments"],
    },
    {
      id: "clinical",
      label: "Clinical only — no money",
      help: "All clinical work (prescriptions, notes, documents). No prices, payments or estimates.",
      off: ["prices", "payments", "estimates"],
    },
    {
      id: "today-full",
      label: "Today's patients, full clinical",
      help: "Only today's patients, but full clinical and estimate access.",
      off: ["allPatients"],
    },
  ],
  RECEPTIONIST: [
    { id: "full", label: "Full front desk (default)", help: "Everything reception can do today.", off: [] },
    {
      id: "front-desk",
      label: "Appointments and queue only",
      help: "Registers patients, books appointments, runs the queue. No prices, payments or billing.",
      off: ["prices", "payments", "collectPayments", "documents"],
    },
    {
      id: "billing",
      label: "Billing desk",
      help: "Collects payments and bills. No appointments, queue or WhatsApp.",
      off: ["appointments", "queue", "whatsapp", "documents"],
    },
    {
      id: "today-desk",
      label: "Today's patients only",
      help: "Full front desk, limited to today's appointments and queue.",
      off: ["allPatients"],
    },
  ],
}

/** Effective permissions for a role + stored overrides. Admin always has everything. */
export function effectivePerms(role: Role, stored: unknown): Perms {
  const overrides = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {}
  const out = {} as Perms
  for (const key of PERMISSION_KEYS) {
    const applies = role === "ADMIN" || (PERMISSIONS[key].roles as readonly Role[]).includes(role)
    out[key] = role === "ADMIN" || (applies && overrides[key] !== false)
  }
  // Estimates and billing are meaningless without prices.
  if (!out.prices) {
    out.estimates = false
    out.collectPayments = false
  }
  return out
}

/** What to store from a set of switches: only the OFF keys that apply to the role. */
export function toOverrides(role: Role, perms: Partial<Record<PermissionKey, boolean>>): Record<string, false> | null {
  if (role === "ADMIN") return null
  const off: Record<string, false> = {}
  for (const key of keysForRole(role)) if (perms[key] === false) off[key] = false
  return Object.keys(off).length ? off : null
}

/** Keys an admin can toggle for this role. */
export function keysForRole(role: Role): PermissionKey[] {
  return PERMISSION_KEYS.filter((k) => (PERMISSIONS[k].roles as readonly Role[]).includes(role))
}
