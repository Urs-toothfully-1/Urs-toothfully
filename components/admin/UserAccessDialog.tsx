"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ShieldCheck, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BRAND_COLORS } from "@/lib/constants"
import { setUserPermissionsAction } from "@/actions/users"
import {
  PERMISSIONS,
  PRESETS,
  effectivePerms,
  keysForRole,
  type PermissionKey,
} from "@/lib/permissions"

type StaffRole = "DOCTOR" | "RECEPTIONIST"

/** Admin control for one staff member: pick a scenario, then fine-tune switches. */
export function UserAccessDialog({
  user,
}: {
  user: { id: string; name: string; role: StaffRole; permissions: unknown }
}) {
  const router = useRouter()
  const keys = keysForRole(user.role)
  const presets = PRESETS[user.role]
  const initial = effectivePerms(user.role, user.permissions)
  const [open, setOpen] = useState(false)
  const [perms, setPerms] = useState<Record<PermissionKey, boolean>>(initial)
  const [saving, startSaving] = useTransition()

  const presetPerms = (off: readonly PermissionKey[]) =>
    Object.fromEntries(keys.map((k) => [k, !off.includes(k)])) as Record<PermissionKey, boolean>
  const matches = (p: Record<PermissionKey, boolean>, off: readonly PermissionKey[]) =>
    keys.every((k) => p[k] === !off.includes(k))
  const matchingId = (p: Record<PermissionKey, boolean>) =>
    presets.find((x) => matches(p, x.off))?.id ?? "custom"
  const restricted = keys.some((k) => !initial[k])
  // The scenario whose "What they get" list is open. Ticking items keeps it
  // open and marks it "customised" rather than jumping to another scenario.
  const [active, setActive] = useState(matchingId(initial))

  function choose(id: string) {
    setActive(id)
    const p = presets.find((x) => x.id === id)
    if (p) setPerms(presetPerms(p.off))
  }

  function toggle(k: PermissionKey) {
    setPerms((prev) => {
      const next = { ...prev, [k]: !prev[k] }
      // Estimates and billing need prices; turning them on turns prices on too.
      if (k === "prices" && !next.prices) {
        next.estimates = false
        next.collectPayments = false
      }
      if ((k === "estimates" || k === "collectPayments") && next[k]) next.prices = true
      return next
    })
  }

  function save() {
    startSaving(async () => {
      const res = await setUserPermissionsAction(
        user.id,
        Object.fromEntries(keys.map((k) => [k, perms[k]]))
      )
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
        onClick={() => {
          setPerms(initial)
          setActive(matchingId(initial))
          setOpen(true)
        }}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-gray-100"
        style={{ color: restricted ? "#B45309" : BRAND_COLORS.borderDivider }}
        title="Access settings"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {restricted ? "Limited access" : "Access"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Access for {user.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
              Scenario
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Scenario">
              {[...presets, { id: "custom", label: "Custom", help: "Start from the current settings and pick each item yourself.", off: [] as PermissionKey[] }].map((p) => {
                const isActive = active === p.id
                const customised = isActive && p.id !== "custom" && !matches(perms, p.off)
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border"
                    style={{ borderColor: isActive ? BRAND_COLORS.primaryTeal : "#E0E3E5", backgroundColor: isActive ? `${BRAND_COLORS.primaryTeal}08` : "white" }}
                  >
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                      <input
                        type="radio"
                        name="access-scenario"
                        checked={isActive}
                        onChange={() => (p.id === "custom" ? setActive("custom") : choose(p.id))}
                        className="mt-0.5 h-4 w-4 accent-[#005E97]"
                      />
                      <span>
                        <span className="block text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                          {p.label}
                          {customised && (
                            <span className="ml-2 text-[11px] font-medium" style={{ color: "#B45309" }}>customised</span>
                          )}
                        </span>
                        <span className="block text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{p.help}</span>
                      </span>
                    </label>

                    {isActive && (
                      <div className="border-t px-3 pb-2 pt-2" style={{ borderColor: "#E0E3E5" }}>
                        <p className="mb-1 pl-7 text-[11px] font-semibold uppercase tracking-wide" style={{ color: BRAND_COLORS.borderDivider }}>
                          What they get
                        </p>
                        <ul>
                          {keys.map((k) => (
                            <li key={k}>
                              <label className="flex cursor-pointer items-start gap-3 rounded py-1.5 pl-7 pr-2 hover:bg-white">
                                <input
                                  type="checkbox"
                                  checked={perms[k]}
                                  onChange={() => toggle(k)}
                                  className="mt-0.5 h-4 w-4 accent-[#005E97]"
                                />
                                <span>
                                  <span className="block text-sm" style={{ color: BRAND_COLORS.bodyText }}>{PERMISSIONS[k].label}</span>
                                  <span className="block text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{PERMISSIONS[k].help}</span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Changes apply on {user.name}&apos;s next click — no need to log out.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
