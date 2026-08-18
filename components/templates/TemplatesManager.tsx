"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { DURATION_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/dosage-options"
import { MEDICINE_CATEGORIES, PHRASE_SPECIALTIES } from "@/lib/template-options"
import {
  deleteProtocolAction,
  saveMedicineAction,
  savePhraseAction,
  saveProtocolAction,
  setMedicineActiveAction,
  setPhraseActiveAction,
} from "@/actions/templates"
import { toast } from "sonner"

interface Phrase {
  id: string
  name: string
  specialty: string
  section: string
  isActive: boolean
  isStandard: boolean
}
interface Medicine {
  id: string
  name: string
  category: string
  isActive: boolean
}
interface ProtocolItem {
  medicine: string
  frequency: string
  duration: string
}
interface Protocol {
  id: string
  name: string
  description: string
  items: ProtocolItem[]
}

interface Props {
  phrases: Phrase[]
  medicines: Medicine[]
  protocols: Protocol[]
}

type Tab = "COMPLAINT" | "DIAGNOSIS" | "MEDICINE" | "PROTOCOL"

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: "COMPLAINT", label: "Chief Complaints", blurb: "What the patient reports." },
  {
    key: "DIAGNOSIS",
    label: "Diagnosis & Examination",
    blurb: "One shared list — these terms are offered in both sections.",
  },
  { key: "MEDICINE", label: "Medicines", blurb: "Your formulary, grouped by category." },
  { key: "PROTOCOL", label: "Medicine Protocols", blurb: "Ready-made sets applied in one click." },
]

export function TemplatesManager({ phrases, medicines, protocols }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("COMPLAINT")
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [, startTransition] = useTransition()

  const [phraseEdit, setPhraseEdit] = useState<Phrase | "new" | null>(null)
  const [medicineEdit, setMedicineEdit] = useState<Medicine | "new" | null>(null)
  const [protocolEdit, setProtocolEdit] = useState<Protocol | "new" | null>(null)

  const q = search.trim().toLowerCase()
  const active = TABS.find((t) => t.key === tab)!

  /**
   * Runs an action and reports whether it succeeded, so a dialog can stay open
   * on failure instead of closing and discarding what the user typed.
   */
  async function run(
    fn: () => Promise<{ success: boolean; error?: string }>,
    okMessage: string
  ): Promise<boolean> {
    const res = await fn()
    if (!res.success) {
      toast.error(res.error ?? "Something went wrong")
      return false
    }
    toast.success(okMessage)
    startTransition(() => router.refresh())
    return true
  }

  // ── Grouped rows for the current tab ──────────────────────────
  const groups = useMemo(() => {
    const bucket = new Map<string, { id: string; name: string; isActive: boolean; isStandard?: boolean }[]>()

    if (tab === "MEDICINE") {
      for (const m of medicines) {
        if (!showArchived && !m.isActive) continue
        if (q && !m.name.toLowerCase().includes(q)) continue
        if (!bucket.has(m.category)) bucket.set(m.category, [])
        bucket.get(m.category)!.push(m)
      }
    } else if (tab !== "PROTOCOL") {
      for (const p of phrases) {
        if (p.section !== tab) continue
        if (!showArchived && !p.isActive) continue
        if (q && !p.name.toLowerCase().includes(q)) continue
        if (!bucket.has(p.specialty)) bucket.set(p.specialty, [])
        bucket.get(p.specialty)!.push(p)
      }
    }
    return [...bucket.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tab, phrases, medicines, q, showArchived])

  const visibleProtocols = protocols.filter((p) => !q || p.name.toLowerCase().includes(q))
  const totalRows = groups.reduce((n, [, items]) => n + items.length, 0)

  const addLabel =
    tab === "MEDICINE" ? "Add medicine" : tab === "PROTOCOL" ? "Add protocol" : "Add entry"

  function handleAdd() {
    if (tab === "MEDICINE") setMedicineEdit("new")
    else if (tab === "PROTOCOL") setProtocolEdit("new")
    else setPhraseEdit("new")
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: "#E0E3E5" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSearch("") }}
            className="px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === t.key ? BRAND_COLORS.primaryTeal : "transparent",
              color: tab === t.key ? BRAND_COLORS.primaryTeal : BRAND_COLORS.borderDivider,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
          <Input
            placeholder={`Search ${active.label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        {tab !== "PROTOCOL" && (
          <label className="flex items-center gap-1.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        )}
        <Button type="button" onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {addLabel}
        </Button>
      </div>

      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
        {active.blurb}
      </p>

      {/* ── Protocols ────────────────────────────────────────── */}
      {tab === "PROTOCOL" ? (
        <div className="space-y-3">
          {visibleProtocols.length === 0 ? (
            <EmptyState text="No protocols yet." />
          ) : (
            visibleProtocols.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 bg-white" style={{ borderColor: "#E0E3E5" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{p.name}</p>
                    {p.description && (
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{p.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <IconBtn label="Edit" onClick={() => setProtocolEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      label="Delete"
                      danger
                      onClick={() => {
                        if (!confirm(`Delete the "${p.name}" protocol?`)) return
                        run(() => deleteProtocolAction(p.id), "Protocol deleted")
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {p.items.map((i, idx) => (
                    <li key={idx} className="text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                      {i.medicine}
                      <span style={{ color: BRAND_COLORS.borderDivider }}>
                        {i.frequency ? ` · ${i.frequency}` : ""}{i.duration ? ` · ${i.duration}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : totalRows === 0 ? (
        <EmptyState text={q ? `No match for "${search.trim()}".` : "Nothing here yet."} />
      ) : (
        <div className="space-y-4">
          {groups.map(([group, items]) => (
            <div key={group} className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: "#E0E3E5" }}>
              <div
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: BRAND_COLORS.primaryTeal, backgroundColor: "#F7F9FB" }}
              >
                {group} · {items.length}
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 border-t"
                  style={{ borderColor: "#F2F4F6" }}
                >
                  <span
                    className="text-sm truncate"
                    style={{ color: item.isActive ? BRAND_COLORS.bodyText : BRAND_COLORS.borderDivider }}
                  >
                    {item.name}
                    {!item.isActive && <span className="ml-2 text-xs">(archived)</span>}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <IconBtn
                      label="Edit"
                      onClick={() =>
                        tab === "MEDICINE"
                          ? setMedicineEdit(medicines.find((m) => m.id === item.id)!)
                          : setPhraseEdit(phrases.find((p) => p.id === item.id)!)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      label={item.isActive ? "Archive" : "Restore"}
                      onClick={() =>
                        run(
                          () =>
                            tab === "MEDICINE"
                              ? setMedicineActiveAction(item.id, !item.isActive)
                              : setPhraseActiveAction(item.id, !item.isActive),
                          item.isActive ? "Archived" : "Restored"
                        )
                      }
                    >
                      {item.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </IconBtn>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {phraseEdit && (
        <PhraseDialog
          section={tab === "COMPLAINT" ? "COMPLAINT" : "DIAGNOSIS"}
          value={phraseEdit === "new" ? null : phraseEdit}
          onSave={(data, id) => run(() => savePhraseAction(data, id), id ? "Updated" : "Added")}
          onClose={() => setPhraseEdit(null)}
        />
      )}

      {medicineEdit && (
        <MedicineDialog
          value={medicineEdit === "new" ? null : medicineEdit}
          onSave={(data, id) => run(() => saveMedicineAction(data, id), id ? "Updated" : "Added")}
          onClose={() => setMedicineEdit(null)}
        />
      )}

      {protocolEdit && (
        <ProtocolDialog
          value={protocolEdit === "new" ? null : protocolEdit}
          medicineNames={medicines.filter((m) => m.isActive).map((m) => m.name)}
          onSave={(data, id) => run(() => saveProtocolAction(data, id), id ? "Updated" : "Added")}
          onClose={() => setProtocolEdit(null)}
        />
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border text-center py-12 text-sm"
      style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.borderDivider }}
    >
      {text}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
  danger,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1.5 rounded hover:bg-slate-100"
      style={{ color: danger ? "#DC2626" : BRAND_COLORS.primaryTeal }}
    >
      {children}
    </button>
  )
}

// ── Dialogs ───────────────────────────────────────────────────────────────

function PhraseDialog({
  section,
  value,
  onSave,
  onClose,
}: {
  section: "DIAGNOSIS" | "COMPLAINT"
  value: Phrase | null
  onSave: (data: { name: string; specialty: string; section: string }, id?: string) => Promise<boolean>
  onClose: () => void
}) {
  const groups = PHRASE_SPECIALTIES[section]
  const [name, setName] = useState(value?.name ?? "")
  const [specialty, setSpecialty] = useState(value?.specialty ?? groups[0])
  const [busy, setBusy] = useState(false)

  // Closing only on success keeps a rejected name (e.g. a duplicate) on screen
  // to correct, instead of throwing the typing away.
  async function submit() {
    setBusy(true)
    const ok = await onSave({ name, specialty, section }, value?.id)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {value ? "Edit entry" : section === "COMPLAINT" ? "New chief complaint" : "New diagnosis term"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Text</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={section === "COMPLAINT" ? "e.g. Pain on chewing" : "e.g. Irreversible Pulpitis"}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Group</Label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full text-sm border rounded px-2 h-9"
            >
              {/* An entry from an older list may sit in a group no longer offered —
                  keep it selectable so editing does not silently move it. */}
              {[...new Set([...groups, specialty])].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || busy} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MedicineDialog({
  value,
  onSave,
  onClose,
}: {
  value: Medicine | null
  onSave: (data: { name: string; category: string }, id?: string) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState(value?.name ?? "")
  const [category, setCategory] = useState<string>(value?.category ?? MEDICINE_CATEGORIES[0])
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const ok = await onSave({ name, category }, value?.id)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{value ? "Edit medicine" : "New medicine"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tab Augmentin 625mg"
              className="text-sm"
            />
            <p className="text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>
              Include the strength in the name, as the rest of the list does.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm border rounded px-2 h-9"
            >
              {[...new Set([...MEDICINE_CATEGORIES, category])].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || busy} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProtocolDialog({
  value,
  medicineNames,
  onSave,
  onClose,
}: {
  value: Protocol | null
  medicineNames: string[]
  onSave: (
    data: { name: string; description?: string; items: ProtocolItem[] },
    id?: string
  ) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState(value?.name ?? "")
  const [description, setDescription] = useState(value?.description ?? "")
  const [items, setItems] = useState<ProtocolItem[]>(
    value?.items.length ? value.items : [{ medicine: "", frequency: "", duration: "" }]
  )
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const ok = await onSave(
      {
        name,
        description: description.trim() || undefined,
        items: items.filter((i) => i.medicine.trim()),
      },
      value?.id
    )
    setBusy(false)
    if (ok) onClose()
  }

  const update = (idx: number, patch: Partial<ProtocolItem>) =>
    setItems((prev) => prev.map((i, n) => (n === idx ? { ...i, ...patch } : i)))

  const valid = name.trim() && items.some((i) => i.medicine.trim())

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{value ? "Edit protocol" : "New protocol"}</DialogTitle>
        </DialogHeader>

        {/* Medicine names suggest from the formulary but stay free-text. */}
        <datalist id="protocol-medicine-options">
          {medicineNames.map((m) => <option key={m} value={m} />)}
        </datalist>
        <datalist id="protocol-frequency-options">
          {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </datalist>
        <datalist id="protocol-duration-options">
          {DURATION_OPTIONS.map((o) => <option key={o} value={o} />)}
        </datalist>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Protocol name</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Post-extraction"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When to use this"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Medicines</Label>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  list="protocol-medicine-options"
                  value={item.medicine}
                  onChange={(e) => update(idx, { medicine: e.target.value })}
                  placeholder="Medicine"
                  className="col-span-6 text-xs"
                />
                <Input
                  list="protocol-frequency-options"
                  value={item.frequency}
                  onChange={(e) => update(idx, { frequency: e.target.value })}
                  placeholder="1-0-1"
                  className="col-span-2 text-xs"
                />
                <Input
                  list="protocol-duration-options"
                  value={item.duration}
                  onChange={(e) => update(idx, { duration: e.target.value })}
                  placeholder="5 days"
                  className="col-span-3 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, n) => n !== idx))}
                  disabled={items.length === 1}
                  className="col-span-1 p-1.5 rounded text-red-500 hover:bg-red-50 disabled:opacity-30"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setItems((prev) => [...prev, { medicine: "", frequency: "", duration: "" }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add medicine
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" disabled={!valid || busy} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
