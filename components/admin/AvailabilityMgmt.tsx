"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { upsertAvailabilityAction, AvailabilityFormState } from "@/actions/availability"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CalendarClock, Edit2, Loader2 } from "lucide-react"

interface Doctor { id: string; name: string; doctorRegNo: string | null }
interface Branch { id: string; name: string }
interface Schedule {
  doctorId: string
  branchId: string
  workingDays: string
  startTime: string
  endTime: string
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
const DAY_LABELS: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} size="sm" className="h-8 text-xs text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
    </Button>
  )
}

interface EditFormProps {
  doctorId: string
  branchId: string
  existing?: Schedule
  onCancel: () => void
}

function EditForm({ doctorId, branchId, existing, onCancel }: EditFormProps) {
  const [state, action] = useActionState(upsertAvailabilityAction, {} as AvailabilityFormState)
  const existingDays = existing?.workingDays.split(",") ?? ["MON", "TUE", "WED", "FRI", "SAT"]

  if (state.success) {
    onCancel()
    return null
  }

  return (
    <form action={action} className="mt-2 p-3 rounded-lg border border-dashed space-y-3"
      style={{ borderColor: BRAND_COLORS.primaryTeal }}>
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="branchId" value={branchId} />

      {state.error && <p className="text-xs text-red-500">{state.error}</p>}

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: BRAND_COLORS.bodyText }}>Working Days</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label key={day} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" name={`day_${day}`} defaultChecked={existingDays.includes(day)}
                className="accent-[#4ABCC8]" />
              <span className="text-xs" style={{ color: BRAND_COLORS.bodyText }}>{DAY_LABELS[day]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="space-y-1">
          <label className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Start Time</label>
          <Input type="time" name="startTime" defaultValue={existing?.startTime ?? "10:30"}
            className="h-8 w-28 border-[#CCCCCC] bg-[#EBECEE] text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>End Time</label>
          <Input type="time" name="endTime" defaultValue={existing?.endTime ?? "20:30"}
            className="h-8 w-28 border-[#CCCCCC] bg-[#EBECEE] text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Effective From</label>
          <Input type="date" name="effectiveFrom" defaultValue={new Date().toISOString().split("T")[0]}
            className="h-8 w-36 border-[#CCCCCC] bg-[#EBECEE] text-sm" />
        </div>
      </div>

      <div className="flex gap-2">
        <SubmitBtn />
        <Button type="button" variant="outline" size="sm" onClick={onCancel}
          className="h-8 text-xs border-[#CCCCCC]">Cancel</Button>
      </div>
    </form>
  )
}

export function AvailabilityMgmt({ doctors, branches, schedules }: {
  doctors: Doctor[]; branches: Branch[]; schedules: Schedule[]
}) {
  const [editing, setEditing] = useState<{ doctorId: string; branchId: string } | null>(null)

  function getSchedule(doctorId: string, branchId: string) {
    return schedules.find((s) => s.doctorId === doctorId && s.branchId === branchId)
  }

  return (
    <div className="space-y-4">
      {doctors.map((doctor) => (
        <Card key={doctor.id} className="border-[#CCCCCC] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <CalendarClock className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              {doctor.name}
              {doctor.doctorRegNo && (
                <span className="text-xs font-normal" style={{ color: BRAND_COLORS.borderDivider }}>
                  Reg: {doctor.doctorRegNo}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {branches.map((branch) => {
              const schedule = getSchedule(doctor.id, branch.id)
              const isEditing = editing?.doctorId === doctor.id && editing?.branchId === branch.id

              return (
                <div key={branch.id} className="rounded-lg border p-3"
                  style={{ borderColor: schedule ? `${BRAND_COLORS.primaryTeal}30` : BRAND_COLORS.lightBackground }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                        {branch.name} Branch
                      </p>
                      {schedule ? (
                        <div className="mt-1">
                          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                            {schedule.workingDays.split(",").map((d) => DAY_LABELS[d]).join(", ")}
                          </p>
                          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                            {schedule.startTime} – {schedule.endTime}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                          No schedule set
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditing(isEditing ? null : { doctorId: doctor.id, branchId: branch.id })}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.primaryTeal }} />
                    </button>
                  </div>
                  {isEditing && (
                    <EditForm
                      doctorId={doctor.id}
                      branchId={branch.id}
                      existing={schedule}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
