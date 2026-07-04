"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BRAND_COLORS } from "@/lib/constants"
import type { Role } from "@/lib/session"

const TABS = [
  { label: "Overview", href: "/whatsapp", roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "Templates", href: "/whatsapp/templates", roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "Queue", href: "/whatsapp/queue", roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "Message Logs", href: "/whatsapp/logs", roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "API Settings", href: "/whatsapp/settings", roles: ["ADMIN"] },
]

export function WhatsAppNav({ role }: { role: Role }) {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-1 border-b" style={{ borderColor: BRAND_COLORS.borderLight }}>
      {TABS.filter((t) => t.roles.includes(role)).map((tab) => {
        const isActive = tab.href === "/whatsapp" ? pathname === "/whatsapp" : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors"
            style={
              isActive
                ? { color: BRAND_COLORS.primaryTeal, borderColor: BRAND_COLORS.primaryTeal, fontWeight: 600 }
                : { color: BRAND_COLORS.sidebarMuted, borderColor: "transparent" }
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
