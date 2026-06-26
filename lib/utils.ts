import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const m = today.getMonth() - dateOfBirth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--
  return age
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatCurrency(amount: number | string): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`
}
