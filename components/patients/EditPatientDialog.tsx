"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updatePatientAction, deletePatientAction } from "@/actions/patients"
import { BRAND_COLORS } from "@/lib/constants"
import { isUnknownDob } from "@/lib/patient-dob"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Pencil, Trash2 } from "lucide-react"

export interface EditablePatient {
  id: string
  fullName: string
  dateOfBirth: string // ISO
  gender: string
  mobile: string
  email: string | null
  address: string | null
  leadSource: string | null
  referenceName: string | null
  reasonForVisit: string | null
  registrationBranchId: string
}

interface Props {
  patient: EditablePatient
  branches: { id: string; name: string }[]
  /** Only an administrator may delete */
  canDelete: boolean
}

const inputCls = "h-10 border-[#E0E3E5] bg-[#F2F4F6] text-sm"
const selectCls = "h-10 w-full rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"

export function EditPatientDialog({ patient, branches, canDelete }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reason, setReason] = useState("")
  const [deleting, startDeleting] = useTransition()
  const [saving, startSaving] = useTransition()
  const [state, setState] = useState<Awaited<ReturnType<typeof updatePatientAction>>>({})

  // Awaited directly rather than via useActionState: the result is handled in
  // the same callback, so there is no stale success flag to reopen/close on.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startSaving(async () => {
      const result = await updatePatientAction(patient.id, {}, fd)
      setState(result)
      if (result.success) {
        toast.success("Patient profile updated")
        setOpen(false)
        router.refresh()
      }
    })
  }

  // A stub from an online booking carries a placeholder DOB — start blank so a
  // real one has to be entered rather than silently re-saving the sentinel.
  const dob = isUnknownDob(patient.dateOfBirth) ? "" : patient.dateOfBirth.slice(0, 10)
  const err = (f: string) => state.fieldErrors?.[f]?.[0]

  function handleDelete() {
    startDeleting(async () => {
      const result = await deletePatientAction(patient.id, reason)
      if (result.success) {
        toast.success("Patient deleted — the record is retained in backups")
        router.push("/patients")
      } else {
        toast.error(result.error ?? "Failed to delete patient")
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 border-[#E0E3E5]">
        <Pencil className="h-3.5 w-3.5" />Edit Profile
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient Profile</DialogTitle>
            <DialogDescription>
              Correct any detail, including the branch the patient was registered at.
            </DialogDescription>
          </DialogHeader>

          {state.error && <p className="text-sm text-red-500">{state.error}</p>}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-sm">Registered Branch *</Label>
              <select name="registrationBranchId" required defaultValue={patient.registrationBranchId} className={selectCls}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Full Name *</Label>
              <Input name="fullName" required defaultValue={patient.fullName} className={inputCls} />
              {err("fullName") && <p className="text-xs text-red-500">{err("fullName")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Mobile *</Label>
              <Input name="mobile" required defaultValue={patient.mobile} className={inputCls} />
              {err("mobile") && <p className="text-xs text-red-500">{err("mobile")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Date of Birth *</Label>
              <Input name="dateOfBirth" type="date" required defaultValue={dob} className={inputCls} />
              {err("dateOfBirth") && <p className="text-xs text-red-500">{err("dateOfBirth")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Gender *</Label>
              <select name="gender" required defaultValue={patient.gender} className={selectCls}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Email</Label>
              <Input name="email" type="email" defaultValue={patient.email ?? ""} className={inputCls} />
              {err("email") && <p className="text-xs text-red-500">{err("email")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Lead Source</Label>
              <Input name="leadSource" defaultValue={patient.leadSource ?? ""} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Reference Name</Label>
              <Input name="referenceName" defaultValue={patient.referenceName ?? ""} className={inputCls} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-sm">Address</Label>
              <Input name="address" defaultValue={patient.address ?? ""} className={inputCls} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-sm">Reason for Visit</Label>
              <Textarea name="reasonForVisit" defaultValue={patient.reasonForVisit ?? ""} rows={2}
                className="border-[#E0E3E5] bg-[#F2F4F6] text-sm resize-none" />
            </div>

            <DialogFooter className="md:col-span-2 flex-row justify-between sm:justify-between items-center gap-2">
              {canDelete ? (
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />Delete Patient
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="text-white"
                  style={{ backgroundColor: saving ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {patient.fullName}?</DialogTitle>
            <DialogDescription>
              The profile disappears from search, queues and reports. Nothing is erased —
              the record and its history stay in the database and in every backup.
            </DialogDescription>
          </DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
            placeholder="Reason (e.g. duplicate profile)" className={inputCls} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Keep</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !reason.trim()}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
