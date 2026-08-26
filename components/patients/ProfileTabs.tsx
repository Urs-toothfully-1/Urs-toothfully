"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BRAND_COLORS } from "@/lib/constants"

/** `count` names the key in Props.counts; tabs without one show no badge. */
const TABS = [
  { label: "Overview", href: "" },
  { label: "Dental History", href: "/history" },
  { label: "Visit History", href: "/visits", count: "visits" },
  { label: "Clinical Notes", href: "/notes", count: "notes" },
  { label: "Estimates", href: "/estimates", count: "estimates" },
  { label: "Treatment Progress", href: "/progress" },
  { label: "Payments", href: "/payments", count: "payments" },
  { label: "Documents", href: "/documents", count: "documents" },
] as const

interface Props {
  patientId: string
  counts?: Record<string, number>
}

export function ProfileTabs({ patientId, counts }: Props) {
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
            {/* Zero is shown too: "nothing here" is the useful half of the answer. */}
            {"count" in tab && counts?.[tab.count] !== undefined && (
              <span
                className="ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                style={
                  isActive
                    ? { backgroundColor: `${BRAND_COLORS.primaryTeal}1A`, color: BRAND_COLORS.primaryTeal }
                    : { backgroundColor: "#F2F4F6", color: BRAND_COLORS.borderDivider }
                }
              >
                {counts[tab.count]}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
