"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BRAND_COLORS } from "@/lib/constants"

const TABS = [
  { label: "Overview", href: "" },
  { label: "Dental History", href: "/history" },
  { label: "Visit History", href: "/visits" },
  { label: "Clinical Notes", href: "/notes" },
  { label: "Estimates", href: "/estimates" },
  { label: "Treatment Progress", href: "/progress" },
  { label: "Payments", href: "/payments" },
  { label: "Documents", href: "/documents" },
]

interface Props {
  patientId: string
}

export function ProfileTabs({ patientId }: Props) {
  const pathname = usePathname()
  const base = `/patients/${patientId}`

  return (
    <div
      className="flex overflow-x-auto border-b"
      style={{ borderColor: BRAND_COLORS.lightBackground }}
    >
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`
        const isActive = tab.href === "" ? pathname === base : pathname === href || pathname.startsWith(href + "/")

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              isActive ? "border-current" : "border-transparent hover:border-gray-300"
            )}
            style={
              isActive
                ? { color: BRAND_COLORS.primaryTeal, borderColor: BRAND_COLORS.primaryTeal }
                : { color: BRAND_COLORS.borderDivider }
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
