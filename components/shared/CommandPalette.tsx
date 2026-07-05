"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback"
import type { Role } from "@/lib/session"
import {
  BarChart2, CalendarDays, ClipboardList, CreditCard, LayoutDashboard,
  Loader2, MessageCircle, User, UserPlus, Users,
} from "lucide-react"

interface PatientHit {
  id: string
  patientId: string
  fullName: string
  mobile: string
}

interface NavCommand {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Role[]
}

const NAV_COMMANDS: NavCommand[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "Live Queue", href: "/reception", icon: ClipboardList, roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "My Queue", href: "/doctor", icon: ClipboardList, roles: ["DOCTOR"] },
  { label: "Patients", href: "/patients", icon: Users, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
  { label: "New Patient", href: "/patients/new", icon: UserPlus, roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "Appointments", href: "/appointments", icon: CalendarDays, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
  { label: "Collect Payment", href: "/reception/collect-payment", icon: CreditCard, roles: ["ADMIN", "RECEPTIONIST"] },
  { label: "Reports", href: "/admin/reports", icon: BarChart2, roles: ["ADMIN"] },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, roles: ["ADMIN", "RECEPTIONIST"] },
]

/** Global Ctrl/⌘+K palette: jump to pages or find a patient from anywhere. */
export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<PatientHit[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const search = useDebouncedCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setHits([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(term.trim())}`)
      const data = await res.json()
      setHits((data.patients ?? []).slice(0, 6))
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }, 250)

  function go(href: string) {
    setOpen(false)
    setQuery("")
    setHits([])
    router.push(href)
  }

  const navItems = NAV_COMMANDS.filter((c) => c.roles.includes(role))

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setHits([]) } }}
      title="Quick Search"
      description="Jump to a page or find a patient"
    >
      <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search patients or jump to a page…"
        value={query}
        onValueChange={(v) => { setQuery(v); search(v) }}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? (
            <span className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </span>
          ) : query.trim().length >= 2 ? (
            "No results found."
          ) : (
            "Type to search patients by name, mobile or ID."
          )}
        </CommandEmpty>

        {hits.length > 0 && (
          <CommandGroup heading="Patients">
            {hits.map((h) => (
              <CommandItem key={h.id} value={`patient-${h.id}`} onSelect={() => go(`/patients/${h.id}`)}>
                <User className="h-4 w-4" />
                <span className="font-medium">{h.fullName}</span>
                <span className="text-xs text-muted-foreground ml-auto">{h.patientId} · {h.mobile}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Go to">
          {navItems
            .filter((c) => !query.trim() || c.label.toLowerCase().includes(query.trim().toLowerCase()))
            .map((c) => {
              const Icon = c.icon
              return (
                <CommandItem key={c.href + c.label} value={`nav-${c.label}`} onSelect={() => go(c.href)}>
                  <Icon className="h-4 w-4" />
                  {c.label}
                </CommandItem>
              )
            })}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
