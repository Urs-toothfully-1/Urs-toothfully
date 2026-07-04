"use client"

import { useMemo, useState, useTransition } from "react"
import {
  createWhatsAppTemplateAction,
  updateWhatsAppTemplateAction,
  setWhatsAppTemplateEnabledAction,
  deleteWhatsAppTemplateAction,
  syncTemplatesFromMetaAction,
  syncTemplateToMetaAction,
} from "@/actions/whatsapp"
import { renderTemplateBody } from "@/lib/whatsapp/templates"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  CloudDownload, CloudUpload, Loader2, Pencil, Plus, Search,
  Trash2, ToggleLeft, ToggleRight, Lock,
} from "lucide-react"

export interface TemplateRow {
  id: string
  name: string
  displayName: string
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION"
  language: string
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED"
  isEnabled: boolean
  headerText: string | null
  body: string
  footerText: string | null
  variables: string[]
  metaTemplateId: string | null
  triggerKey: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORIES = ["ALL", "UTILITY", "MARKETING", "AUTHENTICATION"] as const

const STATUS_BADGE: Record<TemplateRow["status"], { bg: string; text: string }> = {
  DRAFT: { bg: "#F3F4F6", text: "#4B5563" },
  PENDING: { bg: "#FEF3C7", text: "#92400E" },
  APPROVED: { bg: "#D1FAE5", text: "#065F46" },
  REJECTED: { bg: "#FEE2E2", text: "#991B1B" },
  DISABLED: { bg: "#F3F4F6", text: "#6B7280" },
}

interface EditState {
  id?: string
  name: string
  displayName: string
  category: TemplateRow["category"]
  language: string
  headerText: string
  body: string
  footerText: string
  variables: string // comma-separated in the form
  isSystem?: boolean
}

const EMPTY_EDIT: EditState = {
  name: "",
  displayName: "",
  category: "UTILITY",
  language: "en",
  headerText: "",
  body: "",
  footerText: "",
  variables: "",
}

const inputCls = "border-[#E0E3E5] bg-[#F2F4F6]"
const labelCls = "block text-sm font-medium mb-1"

export function TemplatesMgmt({ templates, isAdmin }: { templates: TemplateRow[]; isAdmin: boolean }) {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ALL")
  const [edit, setEdit] = useState<EditState | null>(null)
  const [deleting, setDeleting] = useState<TemplateRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((t) => {
      if (category !== "ALL" && t.category !== category) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.displayName.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      )
    })
  }, [templates, search, category])

  function run(fn: () => Promise<{ success?: boolean; error?: string; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        toast.success(result.message)
        after?.()
      } else {
        toast.error(result.error ?? "Failed")
      }
    })
  }

  function handleSave() {
    if (!edit) return
    const payload = {
      name: edit.name.trim(),
      displayName: edit.displayName.trim(),
      category: edit.category,
      language: edit.language.trim() || "en",
      headerText: edit.headerText.trim() || null,
      body: edit.body,
      footerText: edit.footerText.trim() || null,
      variables: edit.variables.split(",").map((v) => v.trim()).filter(Boolean),
    }
    if (edit.id) {
      // Meta template name is immutable once created
      const rest = { ...payload, name: undefined }
      run(() => updateWhatsAppTemplateAction(edit.id!, rest), () => setEdit(null))
    } else {
      run(() => createWhatsAppTemplateAction(payload), () => setEdit(null))
    }
  }

  const previewValues = edit
    ? edit.variables.split(",").map((v) => `[${v.trim() || "…"}]`)
    : []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND_COLORS.sidebarMuted }} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className={`pl-9 ${inputCls}`}
          />
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-3 h-9 rounded-md text-xs font-semibold transition-colors"
              style={
                category === c
                  ? { backgroundColor: BRAND_COLORS.sidebarActiveBg, color: BRAND_COLORS.primaryTeal }
                  : { color: BRAND_COLORS.sidebarMuted }
              }
            >
              {c === "ALL" ? "All" : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" disabled={isPending} onClick={() => run(() => syncTemplatesFromMetaAction())} className="h-9">
              <CloudDownload className="h-4 w-4 mr-1.5" />
              Sync from Meta
            </Button>
            <Button
              disabled={isPending}
              onClick={() => setEdit(EMPTY_EDIT)}
              className="h-9 text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Template
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-sm" style={{ color: BRAND_COLORS.sidebarMuted }}>
              No templates match your search.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const badge = STATUS_BADGE[t.status]
            return (
              <Card key={t.id} className="border-[#E0E3E5] bg-white">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate" style={{ color: BRAND_COLORS.bodyText }}>
                          {t.displayName}
                        </p>
                        {t.isSystem && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: BRAND_COLORS.sidebarMuted }}>
                            <Lock className="h-3 w-3" aria-hidden />
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono mt-0.5" style={{ color: BRAND_COLORS.sidebarMuted }}>
                        {t.name} · {t.language}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge className="border-0 font-medium" style={{ backgroundColor: badge.bg, color: badge.text }}>
                        {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                      </Badge>
                      <Badge variant="outline" className="border-[#E0E3E5] font-medium" style={{ color: BRAND_COLORS.secondaryText }}>
                        {t.category.charAt(0) + t.category.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed line-clamp-3 whitespace-pre-wrap" style={{ color: BRAND_COLORS.secondaryText }}>
                    {t.body}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <p className="text-[11px]" style={{ color: BRAND_COLORS.sidebarMuted }}>
                      {t.variables.length > 0 ? `Variables: ${t.variables.join(", ")}` : "No variables"}
                      {t.triggerKey ? ` · Auto: ${t.triggerKey.replace(/_/g, " ").toLowerCase()}` : ""}
                    </p>

                    {isAdmin && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => run(() => setWhatsAppTemplateEnabledAction(t.id, !t.isEnabled))}
                          disabled={isPending}
                          className="p-2 rounded hover:bg-gray-100 disabled:opacity-40"
                          aria-label={t.isEnabled ? `Disable ${t.displayName}` : `Enable ${t.displayName}`}
                          title={t.isEnabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                        >
                          {t.isEnabled
                            ? <ToggleRight className="h-4.5 w-4.5" style={{ color: BRAND_COLORS.secondaryGreen }} />
                            : <ToggleLeft className="h-4.5 w-4.5" style={{ color: BRAND_COLORS.sidebarMuted }} />}
                        </button>
                        <button
                          onClick={() =>
                            setEdit({
                              id: t.id,
                              name: t.name,
                              displayName: t.displayName,
                              category: t.category,
                              language: t.language,
                              headerText: t.headerText ?? "",
                              body: t.body,
                              footerText: t.footerText ?? "",
                              variables: t.variables.join(", "),
                              isSystem: t.isSystem,
                            })
                          }
                          disabled={isPending}
                          className="p-2 rounded hover:bg-gray-100 disabled:opacity-40"
                          aria-label={`Edit ${t.displayName}`}
                        >
                          <Pencil className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                        </button>
                        {(t.status === "DRAFT" || t.status === "REJECTED") && (
                          <button
                            onClick={() => run(() => syncTemplateToMetaAction(t.id))}
                            disabled={isPending}
                            className="p-2 rounded hover:bg-gray-100 disabled:opacity-40"
                            aria-label={`Submit ${t.displayName} to Meta`}
                            title="Submit to Meta for approval"
                          >
                            <CloudUpload className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                          </button>
                        )}
                        {!t.isSystem && (
                          <button
                            onClick={() => setDeleting(t)}
                            disabled={isPending}
                            className="p-2 rounded hover:bg-red-50 disabled:opacity-40"
                            aria-label={`Delete ${t.displayName}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={edit !== null} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>

          {edit && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                    Template Name (Meta) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    placeholder="payment_receipt"
                    disabled={Boolean(edit.id)}
                    className={inputCls}
                  />
                  <p className="text-xs mt-1" style={{ color: BRAND_COLORS.sidebarMuted }}>
                    Lowercase, numbers and underscores only. Cannot be changed later.
                  </p>
                </div>
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={edit.displayName}
                    onChange={(e) => setEdit({ ...edit, displayName: e.target.value })}
                    placeholder="Payment Receipt"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Category</label>
                  <select
                    value={edit.category}
                    onChange={(e) => setEdit({ ...edit, category: e.target.value as TemplateRow["category"] })}
                    className="w-full h-9 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm"
                  >
                    <option value="UTILITY">Utility</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Language</label>
                  <Input
                    value={edit.language}
                    onChange={(e) => setEdit({ ...edit, language: e.target.value })}
                    placeholder="en"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Header (optional)</label>
                <Input
                  value={edit.headerText}
                  onChange={(e) => setEdit({ ...edit, headerText: e.target.value })}
                  placeholder="Short header text"
                  maxLength={200}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={edit.body}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                  placeholder={"Dear {{1}}, your appointment is on {{2}}…"}
                  rows={5}
                  className="w-full rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] resize-none"
                />
                <p className="text-xs mt-1" style={{ color: BRAND_COLORS.sidebarMuted }}>
                  {"Use {{1}}, {{2}}, … for variables. Each placeholder needs a label below."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Variable Labels</label>
                  <Input
                    value={edit.variables}
                    onChange={(e) => setEdit({ ...edit, variables: e.target.value })}
                    placeholder="Patient Name, Date, Amount"
                    className={inputCls}
                  />
                  <p className="text-xs mt-1" style={{ color: BRAND_COLORS.sidebarMuted }}>
                    Comma-separated, in {"{{1}}, {{2}}"} order.
                  </p>
                </div>
                <div>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Footer (optional)</label>
                  <Input
                    value={edit.footerText}
                    onChange={(e) => setEdit({ ...edit, footerText: e.target.value })}
                    placeholder="Ur's Toothfully"
                    maxLength={200}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Live preview */}
              {edit.body && (
                <div className="rounded-lg p-3 border" style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#166534" }}>
                    Preview
                  </p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: BRAND_COLORS.bodyText }}>
                    {renderTemplateBody(edit.body, previewValues)}
                  </p>
                  {edit.footerText && (
                    <p className="text-xs mt-1.5" style={{ color: BRAND_COLORS.sidebarMuted }}>{edit.footerText}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !edit?.displayName || !edit?.body || (!edit?.id && !edit?.name)}
              className="text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {edit?.id ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: BRAND_COLORS.secondaryText }}>
            {"This permanently removes "}
            <strong>{deleting?.displayName}</strong>
            {" from the system. Templates already approved on Meta are not deleted there."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => deleting && run(() => deleteWhatsAppTemplateAction(deleting.id), () => setDeleting(null))}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
