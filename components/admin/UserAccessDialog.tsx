"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ShieldCheck, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BRAND_COLORS } from "@/lib/constants"
import { setUserPermissionsAction } from "@/actions/users"
import { PERMISSIONS, PRESETS, effectivePerms, keysForRole, type PermissionKey } from "@/lib/permissions"

type StaffRole = "DOCTOR" | "RECEPTIONIST"

/** Admin control for one staff member: pick a scenario, then fine-tune switches. */
export function UserAccessDialog({ user }: { user: { id: string; name: string; role: StaffRole; permissions: unknown } }) {
  const router = useRouter()
  const keys = keysForRole(user.role)
  const presets = PRESETS[user.role]
  const initial = effectivePerms(user.role, user.permissions)
  const [open, setOpen] = useState(false)
  const [perms, setPerms] = useState<Record<PermissionKey, boolean>>(initial)
  const [saving, startSaving] = useTransition()

  const offKeys = keys.filter((k) => !perms[k])
  const preset = presets.find((p) => p.off.length === offKeys.length && p.off.every((k) => !perms[k]))
  const restricted = keys.some((k) => !initial[k])

  function applyPreset(id: string) {
    const p = presets.find((x) => x.id === id)
    if (!p) return
    setPerms(Object.fromEntries(keys.map((k) => [k, !p.off.includes(k)])) as Record<PermissionKey, boolean>)
  }

  function toggle(k: PermissionKey) {
    setPerms((prev) => {
      const next = { ...prev, [k]: !prev[k] }
      // Estimates and billing need prices; turning them on turns prices on too.
      if (k === "prices" && !next.prices) { next.estimates = false; next.collectPayments = false }
      if ((k === "estimates" || k === "collectPayments") && next[k]) next.prices = true
      return next
    })
  }

  function save() {
    startSaving(async () => {
      const res = await setUserPermissionsAction(user.id, Object.fromEntries(keys.map((k) => [k, perms[k]])))
      if (res.success) {
        toast.success(`Access updated for ${user.name}`)
        setOpen(false)
        router.refresh()
      } else toast.error(res.error ?? "Could not save")
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setPerms(initial); setOpen(true) }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-gray-100"
        style={{ color: restricted ? "#B45309" : BRAND_COLORS.borderDivider }}
        title="Access settings"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {restricted ? "Limited access" : "Access"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Access for {user.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }} htmlFor="access-preset">
                Scenario
              </label>
              <select
                id="access-preset"
                value={preset?.id ?? "custom"}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full h-9 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm"
              >
                {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                {!preset && <option value="custom">Custom</option>}
              </select>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                {preset?.help ?? "Your own mix of the switches below."}
              </p>
            </div>

            <ul className="divide-y rounded-md border" style={{ borderColor: "#E0E3E5" }}>
              {keys.map((k) => (
                <li key={k}>
                  <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={perms[k]}
                      onChange={() => toggle(k)}
                      className="mt-0.5 h-4 w-4 accent-[#005E97]"
                    />
                    <span>
                      <span className="block text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>{PERMISSIONS[k].label}</span>
                      <span className="block text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{PERMISSIONS[k].help}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Changes apply on {user.name.split(" ")[0]}&apos;s next click — no need to log out.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving} className="text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Save access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
