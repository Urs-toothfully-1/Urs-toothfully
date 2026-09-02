// Shared between the server page and the client dialog/row — must live in a
// neutral (non-"use client") module so the server import gets the real array,
// not a client-reference proxy.
export const LEDGER_CATEGORIES: { value: string; label: string }[] = [
  { value: "PURCHASE", label: "Purchase" },
  { value: "PETTY_CASH", label: "Petty Cash" },
  { value: "SALARY", label: "Salary / Staff" },
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "LAB", label: "Lab Fees" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "MARKETING", label: "Marketing" },
  { value: "OTHER", label: "Other" },
]
