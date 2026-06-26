"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Role } from "@/lib/session"
import {
  LayoutDashboard, Users, ClipboardList, CreditCard,
  BookOpen, BarChart2, Stethoscope, Settings, UserCog,
  CalendarClock, Shield, FileSpreadsheet,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Role[]
  matchPrefix?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "Reception", href: "/reception", icon: LayoutDashboard, roles: ["RECEPTIONIST"] },
  { label: "My Queue", href: "/doctor", icon: Stethoscope, roles: ["DOCTOR"] },
  { label: "Patients", href: "/patients", icon: Users, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
  { label: "Queue", href: "/reception", icon: ClipboardList, roles: ["ADMIN"] },
  { label: "Accounting", href: "/admin/accounting", icon: BookOpen, roles: ["ADMIN"] },
  { label: "Reports", href: "/admin/reports", icon: BarChart2, roles: ["ADMIN"], matchPrefix: true },
  { label: "Treatments", href: "/admin/treatments", icon: ClipboardList, roles: ["ADMIN"] },
  { label: "Availability", href: "/admin/availability", icon: CalendarClock, roles: ["ADMIN"] },
  { label: "Users", href: "/admin/users", icon: UserCog, roles: ["ADMIN"] },
  { label: "Tally Export", href: "/admin/tally", icon: FileSpreadsheet, roles: ["ADMIN"] },
  { label: "Audit Log", href: "/admin/audit", icon: Shield, roles: ["ADMIN"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
]

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "#F59E0B",
  DOCTOR: "#34D399",
  RECEPTIONIST: "#60A5FA",
}

interface SidebarProps {
  role: Role
  branchName: string
}

export function Sidebar({ role, branchName }: SidebarProps) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full print:hidden" style={{ backgroundColor: "#0F172A" }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0891B2, #0EA5E9)" }}
          >
            T
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Ur's Toothfully</p>
            <p className="text-xs truncate mt-0.5" style={{ color: "#64748B" }}>{branchName} Branch</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-3">
          {visibleItems.map((item) => {
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
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative",
                    isActive
                      ? "text-white"
                      : "hover:text-white"
                  )}
                  style={
                    isActive
                      ? {
                          backgroundColor: "rgba(14,165,233,0.15)",
                          color: "#E0F2FE",
                          boxShadow: "inset 3px 0 0 #0EA5E9",
                        }
                      : { color: "#94A3B8" }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"
                      e.currentTarget.style.color = "#E2E8F0"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = ""
                      e.currentTarget.style.color = "#94A3B8"
                    }
                  }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Role badge */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: ROLE_COLORS[role] }}
          />
          <span className="text-xs font-medium" style={{ color: "#64748B" }}>
            {ROLE_LABELS[role]}
          </span>
        </div>
      </div>
    </aside>
  )
}
