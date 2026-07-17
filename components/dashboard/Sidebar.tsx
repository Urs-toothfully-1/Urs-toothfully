"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/Logo"
import { BRAND_COLORS } from "@/lib/constants"
import type { Role } from "@/lib/session"
import {
  LayoutDashboard, Users, ClipboardList,
  BookOpen, BarChart2, Stethoscope, Settings, UserCog,
  CalendarClock, CalendarDays, Shield, FileSpreadsheet, UserPlus, MessageCircle, PenLine,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Role[]
  matchPrefix?: boolean
  /** Grouping header; "" = ungrouped main items shown first with no label */
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  // Main (no section header)
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "Reception", href: "/reception", icon: LayoutDashboard, roles: ["RECEPTIONIST"] },
  { label: "My Queue", href: "/doctor", icon: Stethoscope, roles: ["DOCTOR"] },
  { label: "My Signature", href: "/doctor/signature", icon: PenLine, roles: ["DOCTOR"] },
  { label: "Patients", href: "/patients", icon: Users, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
  { label: "Appointments", href: "/appointments", icon: CalendarDays, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, roles: ["RECEPTIONIST"], matchPrefix: true },
  // Operations (admin)
  { label: "Queue", href: "/reception", icon: ClipboardList, roles: ["ADMIN"], section: "Operations" },
  { label: "Accounting", href: "/admin/accounting", icon: BookOpen, roles: ["ADMIN"], section: "Operations" },
  { label: "Treatments", href: "/admin/treatments", icon: ClipboardList, roles: ["ADMIN"], section: "Operations" },
  { label: "Availability", href: "/admin/availability", icon: CalendarClock, roles: ["ADMIN"], section: "Operations" },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, roles: ["ADMIN"], matchPrefix: true, section: "Operations" },
  // Insights (admin)
  { label: "Reports", href: "/admin/reports", icon: BarChart2, roles: ["ADMIN"], matchPrefix: true, section: "Insights" },
  { label: "Tally Export", href: "/admin/tally", icon: FileSpreadsheet, roles: ["ADMIN"], section: "Insights" },
  { label: "Audit Log", href: "/admin/audit", icon: Shield, roles: ["ADMIN"], section: "Insights" },
  // Manage (admin)
  { label: "Users", href: "/admin/users", icon: UserCog, roles: ["ADMIN"], section: "Manage" },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"], section: "Manage" },
]

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "#F59E0B",
  DOCTOR: "#006B5F",
  RECEPTIONIST: "#005E97",
}

interface SidebarProps {
  role: Role
  branchName: string
  /** "desktop" (default) hides below md; "drawer" fills the mobile slide-over */
  variant?: "desktop" | "drawer"
  /** Called after a nav link is clicked — used by the mobile drawer to close itself */
  onNavigate?: () => void
}

export function Sidebar({ role, branchName, variant = "desktop", onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const canRegister = role === "ADMIN" || role === "RECEPTIONIST"

  // Group visible items by section, preserving declaration order
  const sections: { title: string; items: NavItem[] }[] = []
  for (const item of visibleItems) {
    const title = item.section ?? ""
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.items.push(item)
    else sections.push({ title, items: [item] })
  }

  return (
    <aside
      className={cn(
        "flex-shrink-0 flex-col h-full print:hidden",
        variant === "desktop" ? "w-60 border-r hidden md:flex" : "w-full flex"
      )}
      style={{ backgroundColor: BRAND_COLORS.sidebarBg, borderColor: BRAND_COLORS.borderLight }}
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: BRAND_COLORS.borderLight }}>
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate" style={{ color: BRAND_COLORS.primaryTeal }}>
              Ur&apos;s Toothfully
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: BRAND_COLORS.sidebarMuted }}>
              {branchName} Branch
            </p>
          </div>
        </div>
      </div>

      {/* Navigation — grouped into sections so long admin lists stay scannable */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {sections.map(({ title, items }) => (
          <div key={title || "main"} className="px-3 mb-1.5">
            {title && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: BRAND_COLORS.sidebarMuted }}>
                {title}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon
                const isActive = item.matchPrefix
                  ? pathname.startsWith(item.href)
                  : (item.href === "/admin" || item.href === "/reception" || item.href === "/doctor"
                    ? pathname === item.href
                    : pathname.startsWith(item.href))

                return (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                      style={
                        isActive
                          ? { backgroundColor: BRAND_COLORS.sidebarActiveBg, color: BRAND_COLORS.primaryTeal, fontWeight: 600 }
                          : { color: BRAND_COLORS.sidebarText }
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) { e.currentTarget.style.backgroundColor = BRAND_COLORS.lightBackground; e.currentTarget.style.color = BRAND_COLORS.bodyText }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = BRAND_COLORS.sidebarText }
                      }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* New Patient shortcut (Stitch: primary action pinned at the bottom) */}
      {canRegister && (
        <div className="px-3 pb-3">
          <Link
            href="/patients/new"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BRAND_COLORS.primaryTealHover }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = BRAND_COLORS.primaryTeal }}
          >
            <UserPlus className="h-4 w-4" />
            New Patient
          </Link>
        </div>
      )}

      {/* Role badge */}
      <div className="px-4 py-4 border-t" style={{ borderColor: BRAND_COLORS.borderLight }}>
        <div className="flex items-center gap-2.5">
          <div
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: ROLE_COLORS[role] }}
          />
          <span className="text-xs font-medium" style={{ color: BRAND_COLORS.sidebarMuted }}>
            {ROLE_LABELS[role]}
          </span>
        </div>
      </div>
    </aside>
  )
}
