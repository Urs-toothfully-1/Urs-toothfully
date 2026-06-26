"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BRAND_COLORS } from "@/lib/constants"
import type { Role } from "@/lib/session"
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CreditCard,
  BookOpen,
  BarChart2,
  Stethoscope,
  Settings,
  UserCog,
  CalendarClock,
  Shield,
  FileSpreadsheet,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Role[]
  matchPrefix?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["ADMIN"],
  },
  {
    label: "Reception",
    href: "/reception",
    icon: LayoutDashboard,
    roles: ["RECEPTIONIST"],
  },
  {
    label: "My Queue",
    href: "/doctor",
    icon: Stethoscope,
    roles: ["DOCTOR"],
  },
  {
    label: "Patients",
    href: "/patients",
    icon: Users,
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
  },
  {
    label: "Queue",
    href: "/reception",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    label: "Accounting",
    href: "/admin/accounting",
    icon: BookOpen,
    roles: ["ADMIN"],
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart2,
    roles: ["ADMIN"],
    matchPrefix: true,
  },
  {
    label: "Treatments",
    href: "/admin/treatments",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    label: "Availability",
    href: "/admin/availability",
    icon: CalendarClock,
    roles: ["ADMIN"],
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: UserCog,
    roles: ["ADMIN"],
  },
  {
    label: "Tally Export",
    href: "/admin/tally",
    icon: FileSpreadsheet,
    roles: ["ADMIN"],
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    icon: Shield,
    roles: ["ADMIN"],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
]

interface SidebarProps {
  role: Role
  branchName: string
}

export function Sidebar({ role, branchName }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-full print:hidden"
      style={{ backgroundColor: BRAND_COLORS.panelGray }}
    >
      {/* Logo area */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: BRAND_COLORS.borderDivider }}
      >
        <p
          className="text-sm font-bold leading-tight"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          Ur&apos;s Toothfully
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: BRAND_COLORS.bodyText }}>
          {branchName} Branch
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
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
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "text-white"
                      : "hover:bg-black/10"
                  )}
                  style={
                    isActive
                      ? { backgroundColor: BRAND_COLORS.primaryTeal, color: "#fff" }
                      : { color: BRAND_COLORS.bodyText }
                  }
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Role badge */}
      <div
        className="px-5 py-3 border-t text-xs"
        style={{ borderColor: BRAND_COLORS.borderDivider, color: BRAND_COLORS.borderDivider }}
      >
        {role}
      </div>
    </aside>
  )
}
