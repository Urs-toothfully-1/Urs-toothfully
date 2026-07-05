"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Sidebar } from "@/components/dashboard/Sidebar"
import type { Role } from "@/lib/session"

interface Props {
  role: Role
  branchName: string
}

/** Hamburger + slide-over drawer shown below the md breakpoint. */
export function MobileSidebar({ role, branchName }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change (covers back/forward navigation too) — adjust
  // state during render instead of in an effect to avoid a wasted re-render
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    if (open) setOpen(false)
  }

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  return (
    <div className="md:hidden print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0E3E5] bg-white text-[#404751] hover:bg-slate-50"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <div className="relative h-full w-72 max-w-[85vw] bg-white shadow-xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#707882] hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar
              role={role}
              branchName={branchName}
              variant="drawer"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
