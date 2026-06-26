"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { logoutAction } from "@/actions/auth"
import { BRAND_COLORS } from "@/lib/constants"
import type { Role } from "@/lib/session"
import { LogOut, Loader2 } from "lucide-react"

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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  // Use useTransition so logoutAction (which calls redirect) works correctly
  // without a form element — avoids accidental re-submission on mobile refresh
  function handleSignOut() {
    setOpen(false)
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-6 border-b flex-shrink-0 bg-white print:hidden"
      style={{ borderColor: BRAND_COLORS.lightBackground }}
    >
      {/* Left — branch name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: BRAND_COLORS.borderDivider }}>
          {branchName} Branch
        </span>
      </div>

      {/* Right — user menu */}
      <div ref={menuRef} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors focus:outline-none"
          aria-label="User menu"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {/* Avatar */}
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            {getInitials(userName)}
          </div>

          {/* Name + Role */}
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold leading-tight" style={{ color: BRAND_COLORS.bodyText }}>
              {userName}
            </p>
            <p className="text-xs leading-tight" style={{ color: BRAND_COLORS.borderDivider }}>
              {ROLE_LABELS[role]}
            </p>
          </div>

          {/* Chevron */}
          <svg
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            style={{ color: BRAND_COLORS.borderDivider }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-white shadow-lg z-50 overflow-hidden"
            style={{ borderColor: BRAND_COLORS.lightBackground }}
            role="menu"
          >
            {/* User info */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: BRAND_COLORS.lightBackground, backgroundColor: BRAND_COLORS.lightBackground }}
            >
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Signed in as</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: BRAND_COLORS.bodyText }}>
                {userName}
              </p>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                {ROLE_LABELS[role]}
              </p>
            </div>

            {/* Sign Out — plain button, no form, no accidental submission */}
            <div className="p-1.5" role="none">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isPending}
                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-red-50 text-red-600 disabled:opacity-60"
                role="menuitem"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {isPending ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
