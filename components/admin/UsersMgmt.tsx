"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createUserAction, toggleUserActiveAction, resetPasswordAction, UserFormState } from "@/actions/users"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, UserCog, KeyRound, Power } from "lucide-react"
import { toast } from "sonner"

interface User { id: string; name: string; email: string; role: string; isActive: boolean; branch: { name: string } }
interface Branch { id: string; name: string }

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN: { bg: "#FEE2E2", color: "#B91C1C" },
  DOCTOR: { bg: "#DBEAFE", color: "#1D4ED8" },
  RECEPTIONIST: { bg: "#D1FAE5", color: "#065F46" },
}

const selectCls = "h-10 w-full rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"

export function UsersMgmt({ users, branches, currentUserId }: { users: User[]; branches: Branch[]; currentUserId: string }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [role, setRole] = useState("RECEPTIONIST")
  const [state, setState] = useState<UserFormState>({})
  const [creating, startCreating] = useTransition()
  const [isPending, startTransition] = useTransition()

  /**
   * Awaited directly rather than through useActionState. That hook left this
   * form broken twice over: its success flag is sticky, so the form slammed shut
   * the moment it was reopened; and because createUserAction called
   * revalidatePath, the follow-up RSC fetch could be aborted by the sidebar's
   * prefetching, leaving the button stuck on "Creating…" forever even though the
   * user had already been created. Handling the result in the same callback
   * sidesteps both.
   */
  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startCreating(async () => {
      const result = await createUserAction({}, fd)
      setState(result)
      if (result.success) {
        setShowForm(false)
        toast.success("User created")
        router.refresh()
      }
    })
  }

  function handleToggle(userId: string, name: string, isActive: boolean) {
    startTransition(async () => {
      const result = await toggleUserActiveAction(userId, !isActive)
      if (result.success) toast.success(`${name} ${!isActive ? "activated" : "deactivated"}`)
      else toast.error(result.error ?? "Failed")
    })
  }

  function handleResetPassword(userId: string) {
    const pw = window.prompt("New password (min 8 characters):")
    if (!pw) return
    startTransition(async () => {
      const result = await resetPasswordAction(userId, pw)
      if (result.success) toast.success("Password reset")
      else toast.error(result.error ?? "Failed")
    })
  }

  const grouped: Record<string, User[]> = { ADMIN: [], DOCTOR: [], RECEPTIONIST: [] }
  for (const u of users) { if (grouped[u.role]) grouped[u.role].push(u) }

  return (
    <div className="space-y-5">
      {/* Add User Form */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <UserCog className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              {showForm ? "New Staff Account" : "Staff Accounts"}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}
              className="h-8 text-xs border-[#E0E3E5]">
              {showForm ? "Cancel" : <><Plus className="h-3.5 w-3.5 mr-1" />Add User</>}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-t pt-4" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            {state.error && (
              <p className="text-sm text-red-500 mb-3">{state.error}</p>
            )}
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Full Name *</Label>
                <Input name="name" required placeholder="Dr. / Mr. / Ms." className="h-10 border-[#E0E3E5] bg-[#F2F4F6] text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Email *</Label>
                <Input name="email" type="email" required className="h-10 border-[#E0E3E5] bg-[#F2F4F6] text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Password *</Label>
                <Input name="password" type="password" required minLength={8} className="h-10 border-[#E0E3E5] bg-[#F2F4F6] text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Role *</Label>
                <select name="role" required value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Home Branch *</Label>
                <select name="branchId" required className={selectCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {role === "DOCTOR" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Registration No.</Label>
                    <Input name="doctorRegNo" placeholder="e.g. 3079A" className="h-10 border-[#E0E3E5] bg-[#F2F4F6] text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Qualification</Label>
                    <Input name="doctorQualification" placeholder="e.g. BDS, MDS" className="h-10 border-[#E0E3E5] bg-[#F2F4F6] text-sm" />
                  </div>
                </>
              )}
              <div className="md:col-span-2 pt-1">
                <Button type="submit" disabled={creating} className="h-10 px-5 font-semibold text-white"
                  style={{ backgroundColor: creating ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}>
                  {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create User"}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* User List by Role */}
      {(["ADMIN", "DOCTOR", "RECEPTIONIST"] as const).map((roleKey) => {
        const roleUsers = grouped[roleKey] ?? []
        if (roleUsers.length === 0) return null
        const style = ROLE_STYLE[roleKey]
        return (
          <Card key={roleKey} className="border-[#E0E3E5] bg-white overflow-hidden">
            <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                <span className="px-2 py-0.5 rounded text-xs font-bold mr-2" style={{ backgroundColor: style.bg, color: style.color }}>
                  {roleKey}
                </span>
                {roleUsers.length} account{roleUsers.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {roleUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-gray-50"
                  style={{ borderColor: BRAND_COLORS.lightBackground, opacity: u.isActive ? 1 : 0.5 }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>{u.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                      {u.email} · {u.branch.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!u.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400">Inactive</span>
                    )}
                    <button onClick={() => handleResetPassword(u.id)} disabled={isPending}
                      className="p-1.5 rounded hover:bg-gray-100" title="Reset Password">
                      <KeyRound className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.borderDivider }} />
                    </button>
                    {u.id !== currentUserId && (
                      <button onClick={() => handleToggle(u.id, u.name, u.isActive)} disabled={isPending}
                        className="p-1.5 rounded hover:bg-gray-100" title={u.isActive ? "Deactivate" : "Activate"}>
                        <Power className="h-3.5 w-3.5" style={{ color: u.isActive ? "#10B981" : BRAND_COLORS.borderDivider }} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
