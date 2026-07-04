/**
 * Default WhatsApp utility templates + automatic trigger keys.
 * Bodies use Meta Cloud API positional variables ({{1}}, {{2}}, …).
 * These are seeded as DRAFT — sync them to Meta from the Template Manager
 * to submit for approval.
 */

export const WHATSAPP_CONSENT_VERSION = "1.0"

export const WHATSAPP_TRIGGERS = {
  APPOINTMENT_CONFIRMATION: "APPOINTMENT_CONFIRMATION",
  APPOINTMENT_REMINDER: "APPOINTMENT_REMINDER",
  APPOINTMENT_RESCHEDULED: "APPOINTMENT_RESCHEDULED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  REGISTRATION_SUCCESSFUL: "REGISTRATION_SUCCESSFUL",
  ESTIMATE_READY: "ESTIMATE_READY",
  PAYMENT_RECEIPT: "PAYMENT_RECEIPT",
  ADVANCE_PAYMENT: "ADVANCE_PAYMENT",
  PRESCRIPTION_READY: "PRESCRIPTION_READY",
  FOLLOW_UP_REMINDER: "FOLLOW_UP_REMINDER",
  TREATMENT_REMINDER: "TREATMENT_REMINDER",
  TREATMENT_COMPLETED: "TREATMENT_COMPLETED",
  REPORT_READY: "REPORT_READY",
  OUTSTANDING_PAYMENT: "OUTSTANDING_PAYMENT",
  VISIT_FEEDBACK: "VISIT_FEEDBACK",
  MISSED_APPOINTMENT: "MISSED_APPOINTMENT",
  DENTAL_RECALL: "DENTAL_RECALL",
  IMPLANT_REVIEW: "IMPLANT_REVIEW",
  RCT_REVIEW: "RCT_REVIEW",
  THANK_YOU: "THANK_YOU",
} as const

export type WhatsAppTriggerKey = (typeof WHATSAPP_TRIGGERS)[keyof typeof WHATSAPP_TRIGGERS]

export interface DefaultTemplateDef {
  name: string
  displayName: string
  triggerKey: WhatsAppTriggerKey
  variables: string[]
  body: string
  footerText?: string
}

const FOOTER = "Ur's Toothfully — Full Mouth Rehabilitation & Implant Centre"

export const DEFAULT_UTILITY_TEMPLATES: DefaultTemplateDef[] = [
  {
    name: "appointment_confirmation",
    displayName: "Appointment Confirmation",
    triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_CONFIRMATION,
    variables: ["Patient Name", "Date", "Time", "Branch"],
    body: "Dear {{1}}, your appointment at Ur's Toothfully is confirmed for {{2}} at {{3}} ({{4}} branch). Please arrive 10 minutes early. For changes, call 7890008331.",
    footerText: FOOTER,
  },
  {
    name: "appointment_reminder",
    displayName: "Appointment Reminder",
    triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_REMINDER,
    variables: ["Patient Name", "Date", "Time", "Branch"],
    body: "Hello {{1}}, this is a reminder of your appointment at Ur's Toothfully on {{2}} at {{3}} ({{4}} branch). Reply or call 7890008331 to reschedule.",
    footerText: FOOTER,
  },
  {
    name: "appointment_rescheduled",
    displayName: "Appointment Rescheduled",
    triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_RESCHEDULED,
    variables: ["Patient Name", "New Date", "New Time", "Branch"],
    body: "Dear {{1}}, your appointment at Ur's Toothfully has been rescheduled to {{2}} at {{3}} ({{4}} branch). We apologise for any inconvenience.",
    footerText: FOOTER,
  },
  {
    name: "appointment_cancelled",
    displayName: "Appointment Cancelled",
    triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_CANCELLED,
    variables: ["Patient Name", "Date"],
    body: "Dear {{1}}, your appointment at Ur's Toothfully on {{2}} has been cancelled. Please call 7890008331 to book a new appointment.",
    footerText: FOOTER,
  },
  {
    name: "registration_successful",
    displayName: "Registration Successful",
    triggerKey: WHATSAPP_TRIGGERS.REGISTRATION_SUCCESSFUL,
    variables: ["Patient Name", "Patient ID"],
    body: "Welcome to Ur's Toothfully, {{1}}! Your registration is complete. Your Patient ID is {{2}} — please quote it on future visits. Hours: Mon–Sat 10:30 AM–8:30 PM, Sun 10 AM–2:30 PM (Thu off).",
    footerText: FOOTER,
  },
  {
    name: "estimate_ready",
    displayName: "Estimate Ready",
    triggerKey: WHATSAPP_TRIGGERS.ESTIMATE_READY,
    variables: ["Patient Name", "Estimate No", "Total Amount"],
    body: "Dear {{1}}, your treatment estimate {{2}} totalling ₹{{3}} is ready at Ur's Toothfully. Please contact reception for details or to plan your treatment.",
    footerText: FOOTER,
  },
  {
    name: "payment_receipt",
    displayName: "Payment Receipt",
    triggerKey: WHATSAPP_TRIGGERS.PAYMENT_RECEIPT,
    variables: ["Patient Name", "Amount", "Receipt No", "Date"],
    body: "Dear {{1}}, we have received your payment of ₹{{2}} (Receipt {{3}}) on {{4}}. Thank you for choosing Ur's Toothfully.",
    footerText: FOOTER,
  },
  {
    name: "advance_payment",
    displayName: "Advance Payment",
    triggerKey: WHATSAPP_TRIGGERS.ADVANCE_PAYMENT,
    variables: ["Patient Name", "Amount", "Receipt No", "Estimate No"],
    body: "Dear {{1}}, your advance payment of ₹{{2}} (Receipt {{3}}) towards estimate {{4}} has been received. Thank you for choosing Ur's Toothfully.",
    footerText: FOOTER,
  },
  {
    name: "prescription_ready",
    displayName: "Prescription Ready",
    triggerKey: WHATSAPP_TRIGGERS.PRESCRIPTION_READY,
    variables: ["Patient Name", "Doctor Name"],
    body: "Dear {{1}}, your prescription from {{2}} at Ur's Toothfully is ready. Please collect it at reception or ask us to share it digitally.",
    footerText: FOOTER,
  },
  {
    name: "follow_up_reminder",
    displayName: "Follow-up Reminder",
    triggerKey: WHATSAPP_TRIGGERS.FOLLOW_UP_REMINDER,
    variables: ["Patient Name", "Follow-up Date"],
    body: "Hello {{1}}, a gentle reminder for your follow-up visit at Ur's Toothfully on {{2}}. Call 7890008331 to confirm your slot.",
    footerText: FOOTER,
  },
  {
    name: "treatment_reminder",
    displayName: "Treatment Reminder",
    triggerKey: WHATSAPP_TRIGGERS.TREATMENT_REMINDER,
    variables: ["Patient Name", "Treatment"],
    body: "Hello {{1}}, your {{2}} treatment at Ur's Toothfully is pending. Please call 7890008331 to schedule your next session.",
    footerText: FOOTER,
  },
  {
    name: "treatment_completed",
    displayName: "Treatment Completed",
    triggerKey: WHATSAPP_TRIGGERS.TREATMENT_COMPLETED,
    variables: ["Patient Name", "Treatment"],
    body: "Congratulations {{1}}! Your {{2}} treatment at Ur's Toothfully is complete. Follow your post-treatment care instructions and contact us if you have any concerns.",
    footerText: FOOTER,
  },
  {
    name: "report_ready",
    displayName: "Report Ready",
    triggerKey: WHATSAPP_TRIGGERS.REPORT_READY,
    variables: ["Patient Name", "Report Type"],
    body: "Dear {{1}}, your {{2}} report is ready at Ur's Toothfully. Please collect it at reception or ask us to share it digitally.",
    footerText: FOOTER,
  },
  {
    name: "outstanding_payment",
    displayName: "Outstanding Payment",
    triggerKey: WHATSAPP_TRIGGERS.OUTSTANDING_PAYMENT,
    variables: ["Patient Name", "Outstanding Amount", "Estimate No"],
    body: "Dear {{1}}, a balance of ₹{{2}} is pending on your treatment estimate {{3}} at Ur's Toothfully. Kindly settle it on your next visit or call 7890008331 for assistance.",
    footerText: FOOTER,
  },
  {
    name: "visit_feedback",
    displayName: "Visit Feedback",
    triggerKey: WHATSAPP_TRIGGERS.VISIT_FEEDBACK,
    variables: ["Patient Name"],
    body: "Dear {{1}}, thank you for visiting Ur's Toothfully. We'd love to hear about your experience — your feedback helps us serve you better. Reply to this message with your thoughts.",
    footerText: FOOTER,
  },
  {
    name: "missed_appointment",
    displayName: "Missed Appointment",
    triggerKey: WHATSAPP_TRIGGERS.MISSED_APPOINTMENT,
    variables: ["Patient Name", "Date"],
    body: "Dear {{1}}, we missed you at your appointment on {{2}} at Ur's Toothfully. Please call 7890008331 to rebook — timely care keeps your smile healthy!",
    footerText: FOOTER,
  },
  {
    name: "dental_recall",
    displayName: "Dental Recall",
    triggerKey: WHATSAPP_TRIGGERS.DENTAL_RECALL,
    variables: ["Patient Name", "Months Since Last Visit"],
    body: "Hello {{1}}, it's been {{2}} months since your last dental check-up at Ur's Toothfully. Regular check-ups prevent bigger problems — call 7890008331 to book yours.",
    footerText: FOOTER,
  },
  {
    name: "implant_review",
    displayName: "Implant Review",
    triggerKey: WHATSAPP_TRIGGERS.IMPLANT_REVIEW,
    variables: ["Patient Name", "Review Date"],
    body: "Dear {{1}}, your dental implant review at Ur's Toothfully is due on {{2}}. Regular reviews ensure the long-term success of your implant. Call 7890008331 to confirm.",
    footerText: FOOTER,
  },
  {
    name: "rct_review",
    displayName: "RCT Review",
    triggerKey: WHATSAPP_TRIGGERS.RCT_REVIEW,
    variables: ["Patient Name", "Review Date"],
    body: "Dear {{1}}, your root canal treatment review at Ur's Toothfully is due on {{2}}. A quick review ensures your treated tooth stays healthy. Call 7890008331 to confirm.",
    footerText: FOOTER,
  },
  {
    name: "thank_you",
    displayName: "Thank You",
    triggerKey: WHATSAPP_TRIGGERS.THANK_YOU,
    variables: ["Patient Name"],
    body: "Thank you, {{1}}, for trusting Ur's Toothfully with your smile! We're always here for your dental care. Mon–Sat 10:30 AM–8:30 PM, Sun 10 AM–2:30 PM (Thu off) · 7890008331.",
    footerText: FOOTER,
  },
]

/** Substitutes ordered values into a template body's {{n}} placeholders (for previews/logs). */
export function renderTemplateBody(body: string, values: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1] ?? `{{${n}}}`)
}

/** Counts the highest {{n}} placeholder in a body. */
export function countTemplateVariables(body: string): number {
  let max = 0
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, Number(m[1]))
  return max
}
