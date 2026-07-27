"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createAppointmentAction, createUnregisteredAppointmentAction } from "@/actions/appointments"
import { istTodayStr } from "@/lib/ist"
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { CalendarPlus, Loader2, Search, User, X } from "lucide-react"

interface PatientHit {
  id: string
  patientId: string
  fullName: string
  mobile: string
}

export interface DoctorOption {
  id: string
  name: string
}

interface Props {
  doctors: DoctorOption[]
  /** preselect a patient (e.g. from the patient profile page) */
  defaultPatient?: PatientHit | null
}

const labelCls = "block text-sm font-medium mb-1"

const todayStr = istTodayStr

export function NewAppointmentDialog({ doctors, defaultPatient = null }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<PatientHit[]>([])
  const [patient, setPatient] = useState<PatientHit | null>(defaultPatient)
  // "existing" = pick a registered patient; "new" = phone/walk-in not yet registered
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [newName, setNewName] = useState("")
  const [newMobile, setNewMobile] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState("10:00")
  const [durationMins, setDurationMins] = useState("30")
  const [reason, setReason] = useState("")

  const search = useDebouncedCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setHits([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(term.trim())}`)
      const data = await res.json()
      setHits((data.patients ?? []).slice(0, 8))
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }, 300)

  function reset() {
    setPatient(defaultPatient)
    setHits([])
    setMode("existing")
    setNewName("")
    setNewMobile("")
    setDoctorId("")
    setDate(todayStr())
    setTime("10:00")
    setDurationMins("30")
    setReason("")
  }

  const readyPatient = mode === "existing" ? Boolean(patient) : newName.trim().length >= 2 && newMobile.trim().length >= 10
  const canSubmit = readyPatient && Boolean(doctorId && date && time)

  function handleCreate() {
    if (!canSubmit) return
    startTransition(async () => {
      const result =
        mode === "new"
          ? await createUnregisteredAppointmentAction({
              fullName: newName,
              mobile: newMobile,
              doctorId,
              date,
              time,
              durationMins: parseInt(durationMins, 10) || 30,
              reason,
            })
          : await (async () => {
              const fd = new FormData()
              fd.set("patientId", patient!.id)
              fd.set("doctorId", doctorId)
              fd.set("date", date)
              fd.set("time", time)
              fd.set("durationMins", durationMins)
              fd.set("reason", reason)
              return createAppointmentAction({}, fd)
            })()
      if (result.success) {
        toast.success(mode === "new" ? "Appointment booked — patient added as unregistered" : "Appointment booked")
        reset()
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to book appointment")
      }
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="text-white"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
      >
        <CalendarPlus className="h-4 w-4 mr-2" />
        New Appointment
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode toggle: registered patient vs phone/walk-in */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
              {([["existing", "Registered patient"], ["new", "New / phone booking"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors"
                  style={mode === m ? { backgroundColor: BRAND_COLORS.primaryTeal, color: "#fff" } : { color: BRAND_COLORS.secondaryText }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "new" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Caller's name" maxLength={200} className="border-[#E0E3E5] bg-[#F2F4F6]" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                    Mobile <span className="text-red-500">*</span>
                  </label>
                  <Input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} placeholder="10-digit number" maxLength={15} className="border-[#E0E3E5] bg-[#F2F4F6]" />
                </div>
                <p className="sm:col-span-2 text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
                  They&apos;ll be added as an unregistered patient — complete their profile when they visit and register.
                </p>
              </div>
            ) : (
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Patient <span className="text-red-500">*</span>
              </label>
              {patient ? (
                <div className="flex items-center justify-between p-3 rounded-md border border-[#E0E3E5] bg-[#F7F9FB]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <User className="h-4 w-4 flex-shrink-0" style={{ color: BRAND_COLORS.primaryTeal }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: BRAND_COLORS.bodyText }}>{patient.fullName}</p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>{patient.patientId} · {patient.mobile}</p>
                    </div>
                  </div>
                  <button onClick={() => setPatient(null)} className="p-2 rounded hover:bg-gray-100" aria-label="Change patient">
                    <X className="h-4 w-4" style={{ color: BRAND_COLORS.sidebarMuted }} />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    {searching ? (
                      <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" style={{ color: BRAND_COLORS.primaryTeal }} />
                    ) : (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND_COLORS.sidebarMuted }} />
                    )}
                    <Input
                      onChange={(e) => search(e.target.value)}
                      placeholder="Search by name, mobile or patient ID…"
                      className="pl-9 border-[#E0E3E5] bg-[#F2F4F6]"
                    />
                  </div>
                  {hits.length > 0 && (
                    <ul className="mt-1 rounded-md border border-[#E0E3E5] bg-white divide-y divide-[#F2F4F6] max-h-52 overflow-y-auto">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button
                            onClick={() => { setPatient(h); setHits([]) }}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#F7F9FB] transition-colors"
                          >
                            <span className="text-sm font-medium block" style={{ color: BRAND_COLORS.bodyText }}>{h.fullName}</span>
                            <span className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>{h.patientId} · {h.mobile}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Doctor */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Doctor <span className="text-red-500">*</span>
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full h-10 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm"
              >
                <option value="">Select a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Date + time + duration */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                  Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} className="border-[#E0E3E5] bg-[#F2F4F6]" />
              </div>
              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                  Time <span className="text-red-500">*</span>
                </label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="border-[#E0E3E5] bg-[#F2F4F6]" />
              </div>
              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Duration</label>
                <select
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Reason / Notes</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. RCT follow-up, cleaning…"
                maxLength={300}
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !canSubmit}
              className="text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
              Book Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
