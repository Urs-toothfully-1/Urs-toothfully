"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { logoutAction } from "@/actions/auth"
import type { Role } from "@/lib/session"
import { LogOut, Loader2, ChevronDown, Building2 } from "lucide-react"
import { MobileSidebar } from "@/components/dashboard/MobileSidebar"

interface HeaderProps {
  userName: string
  role: Role
  branchName: string
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
}

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  ADMIN: { bg: "#FEF3C7", text: "#92400E" },
  DOCTOR: { bg: "#D1FAE5", text: "#065F46" },
  RECEPTIONIST: { bg: "#DBEAFE", text: "#1E40AF" },
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("")
}

export function Header({ userName, role, branchName }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const roleStyle = ROLE_COLORS[role]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  function handleSignOut() {
    setOpen(false)
    startTransition(async () => { await logoutAction() })
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 bg-white border-b border-[#E0E3E5] flex-shrink-0 print:hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Left — hamburger (mobile) + branch chip (Stitch style) */}
      <div className="flex items-center gap-3">
        <MobileSidebar role={role} branchName={branchName} />
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
          style={{ borderColor: "#E0E3E5", backgroundColor: "#F7F9FB" }}
        >
          <Building2 className="h-3.5 w-3.5" style={{ color: "#005E97" }} />
          <span className="text-sm font-medium truncate" style={{ color: "#404751" }}>
            {branchName} Branch
          </span>
        </div>
      </div>

      {/* Right — user menu */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-colors hover:bg-slate-50 focus:outline-none"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {/* Avatar */}
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #005E97, #0077BE)" }}
          >
            {getInitials(userName)}
          </div>

          {/* Name + role badge */}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold leading-tight" style={{ color: "#191C1E" }}>
              {userName}
            </p>
            <span
              className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-tight mt-0.5"
              style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>

          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: "#707882" }}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-white shadow-lg z-50 overflow-hidden"
            style={{ borderColor: "#E0E3E5", boxShadow: "0 10px 40px rgba(0,0,0,0.12)" }}
            role="menu"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-[#F2F4F6]" style={{ backgroundColor: "#F7F9FB" }}>
              <p className="text-xs font-medium" style={{ color: "#707882" }}>Signed in as</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "#191C1E" }}>{userName}</p>
              <span
                className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1"
                style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
              >
                {ROLE_LABELS[role]}
              </span>
            </div>

            {/* Sign out */}
            <div className="p-1.5" role="none">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isPending}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-50 text-red-600 disabled:opacity-60"
                role="menuitem"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {isPending ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
