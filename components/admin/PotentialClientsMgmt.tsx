"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  addPotentialClientAction, deletePotentialClientsAction, importPotentialClientsAction,
  sendPotentialClientsWhatsAppAction, updatePotentialClientAction,
} from "@/actions/potential-clients"
import { parseCsv } from "@/lib/csv"
import { renderTemplateBody } from "@/lib/whatsapp/templates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarClock, CheckCircle2, Download, FileUp, Loader2, MessageCircle, Pencil, Phone, Plus, Search, Trash2, Upload, UserCheck, UserPlus, Users } from "lucide-react"

type LeadStatus = "NEW" | "CONTACTED" | "CONVERTED" | "NOT_INTERESTED"
const STATUS_LABEL: Record<LeadStatus, string> = { NEW: "New", CONTACTED: "Contacted", CONVERTED: "Converted", NOT_INTERESTED: "Not interested" }
const STATUS_CLS: Record<LeadStatus, string> = {
  NEW: "bg-sky-50 text-sky-700", CONTACTED: "bg-amber-50 text-amber-700", CONVERTED: "bg-emerald-50 text-emerald-700", NOT_INTERESTED: "bg-gray-100 text-gray-600",
}

export interface LeadRowView {
  id: string; fullName: string; mobile: string; email: string | null; area: string | null; source: string | null; notes: string | null
  whatsappOptIn: boolean; status: LeadStatus; messageCount: number; lastMessagedAt: string | null; createdAt: string
  enquiry: string | null; lastMessage: string | null; followUpOn: string | null // YYYY-MM-DD
  patient: { id: string; patientId: string } | null
}
type LeadPatch = Parameters<typeof updatePotentialClientAction>[1]
interface TemplateView { id: string; displayName: string; body: string; category: string; variables: string[] }

// CSV header → field. First match wins; matching ignores case/spaces/punctuation.
const FIELD_ALIASES: Record<string, string[]> = {
  fullName: ["name", "fullname", "patientname", "clientname", "customername", "leadname"],
  mobile: ["mobile", "mobileno", "mobilenumber", "phone", "phoneno", "phonenumber", "contact", "contactno", "contactnumber", "whatsapp", "whatsappnumber", "number"],
  email: ["email", "emailid", "emailaddress", "mail"],
  area: ["area", "city", "location", "locality", "address", "place"],
  source: ["source", "leadsource", "campaign", "channel"],
  notes: ["notes", "note", "remarks", "remark", "comment", "comments"],
  enquiry: ["enquiry", "inquiry", "treatment", "treatmentenquiry", "interest", "interestedin", "service"],
  lastMessage: ["lastmessage", "message", "lastconversation", "conversation", "lastchat"],
}
const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "")

function mapColumns(header: string[]) {
  const map: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(norm(h)))
    if (idx >= 0) map[field] = idx
  }
  return map
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
const waLink = (mobile: string) => `https://wa.me/${mobile.length === 10 ? `91${mobile}` : mobile}`

export function PotentialClientsMgmt({ rows, total, page, pageSize, counts, optedIn, due, filters, templates, treatments }: {
  rows: LeadRowView[]; total: number; page: number; pageSize: number
  counts: Partial<Record<LeadStatus, number>>; optedIn: number; due: number
  filters: { q: string; status: string; optin: string; due: string }; templates: TemplateView[]; treatments: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const [q, setQ] = useState(filters.q)
  const allTotal = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0)

  function go(patch: Record<string, string>) {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    if (!("page" in patch)) p.delete("page")
    router.push(`${pathname}?${p.toString()}`)
  }

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s)
      for (const r of rows) {
        if (allOnPage) n.delete(r.id)
        else n.add(r.id)
      }
      return n
    })
  }
  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const [editing, setEditing] = useState<LeadRowView | null>(null)
  function update(id: string, data: LeadPatch) {
    start(async () => {
      const res = await updatePotentialClientAction(id, data)
      if (res.error) toast.error(res.error); else router.refresh()
    })
  }
  function removeSelected() {
    if (!window.confirm(`Delete ${selected.size} potential client${selected.size === 1 ? "" : "s"}?`)) return
    start(async () => {
      const res = await deletePotentialClientsAction([...selected])
      if (res.error) toast.error(res.error); else { toast.success(`Deleted ${res.count}`); setSelected(new Set()); router.refresh() }
    })
  }

  // Each tile is also a one-click filter.
  const stats: { label: string; value: number; icon: typeof Users; cls: string; patch: Record<string, string>; on: boolean }[] = [
    { label: "Potential clients", value: allTotal, icon: Users, cls: "text-[#005E97]", patch: { status: "", optin: "", due: "" }, on: !filters.status && !filters.optin && !filters.due },
    { label: "Follow-ups due", value: due, icon: CalendarClock, cls: "text-red-600", patch: { due: "1", status: "" }, on: !!filters.due },
    { label: "WhatsApp opted-in", value: optedIn, icon: MessageCircle, cls: "text-emerald-600", patch: { optin: "yes", due: "" }, on: filters.optin === "yes" },
    { label: "Contacted", value: counts.CONTACTED ?? 0, icon: CheckCircle2, cls: "text-amber-600", patch: { status: "CONTACTED", due: "" }, on: filters.status === "CONTACTED" },
    { label: "Converted", value: counts.CONVERTED ?? 0, icon: UserCheck, cls: "text-violet-600", patch: { status: "CONVERTED", due: "" }, on: filters.status === "CONVERTED" },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Potential Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">Leads imported from a CSV. Send them approved WhatsApp templates — only people who opted in are messaged.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/patients/export" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export all patients (CSV)
          </a>
          <AddLeadDialog />
          <ImportDialog />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(({ label, value, icon: Icon, cls, patch, on }) => (
          <button key={label} type="button" onClick={() => go(patch)}
            className={`rounded-xl bg-white shadow-sm px-4 py-3 text-left transition ${on ? "ring-2 ring-[#005E97]" : "ring-1 ring-black/5 hover:ring-gray-300"}`}>
            <p className="flex items-center gap-1.5 text-xs text-gray-500"><Icon className={`h-3.5 w-3.5 ${cls}`} /> {label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value.toLocaleString("en-IN")}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white ring-1 ring-black/5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
          <form onSubmit={(e) => { e.preventDefault(); go({ q }) }} className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, area, enquiry, notes" className="h-9 w-72 pl-8" />
          </form>
          <select value={filters.status} onChange={(e) => go({ status: e.target.value })} className="h-9 rounded-md border border-gray-200 px-2 text-sm bg-white" aria-label="Status filter">
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select value={filters.optin} onChange={(e) => go({ optin: e.target.value })} className="h-9 rounded-md border border-gray-200 px-2 text-sm bg-white" aria-label="Opt-in filter">
            <option value="">Opt-in: any</option>
            <option value="yes">Opted in</option>
            <option value="no">Not opted in</option>
          </select>
          <span className="hidden text-[11px] text-gray-400 lg:inline">Tip: double-click a cell to edit it</span>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-600">{selected.size} selected</span>
              <SendDialog ids={[...selected]} templates={templates} optedInSelected={rows.filter((r) => selected.has(r.id) && r.whatsappOptIn).length} onDone={() => setSelected(new Set())} />
              <Button size="sm" variant="outline" className="h-8 text-red-600 hover:text-red-700" onClick={removeSelected} disabled={pending}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <FileUp className="h-10 w-10 mx-auto text-gray-300" />
            <p className="mt-3 font-medium text-gray-800">No potential clients {filters.q || filters.status || filters.optin || filters.due ? "match these filters" : "yet"}</p>
            <p className="text-sm text-gray-500">Import a CSV with at least a name and a mobile column.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="w-10 px-3"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" className="h-4 w-4" /></th>
                  {["Name", "Mobile", "Enquiry", "Last message", "Follow-up", "Status", "WhatsApp"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const overdue = !!r.followUpOn && r.followUpOn <= todayStr() && r.status !== "CONVERTED" && r.status !== "NOT_INTERESTED"
                  return (
                  <tr key={r.id} className={`border-b border-gray-50 align-top ${selected.has(r.id) ? "bg-sky-50/50" : "hover:bg-gray-50/60"}`}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.fullName}`} className="h-4 w-4" /></td>
                    <td className="py-2.5 px-3 min-w-[180px]" onDoubleClick={() => setEditing(r)} title="Double-click to edit all details">
                      <span className="font-medium text-gray-900">{r.fullName}</span>
                      <button type="button" onClick={() => setEditing(r)} className="ml-1 rounded p-0.5 text-gray-300 hover:text-gray-600" aria-label={`Edit ${r.fullName}`}><Pencil className="inline h-3 w-3" /></button>
                      {r.patient && (
                        <Link href={`/patients/${r.patient.id}`} className="ml-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 hover:underline">
                          Patient {r.patient.patientId}
                        </Link>
                      )}
                      <span className="block text-[11px] text-gray-400">{[r.area, r.source].filter(Boolean).join(" · ") || "—"}</span>
                      {r.notes && <span className="block text-xs text-gray-500 truncate max-w-[240px]" title={r.notes}>{r.notes}</span>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-700">{r.mobile}</span>
                      <span className="mt-1 flex gap-1">
                        <a href={`tel:${r.mobile}`} className="rounded p-1 text-gray-500 hover:bg-sky-50 hover:text-sky-700" title="Call" aria-label={`Call ${r.fullName}`}><Phone className="h-3.5 w-3.5" /></a>
                        <a href={waLink(r.mobile)} target="_blank" rel="noreferrer" className="rounded p-1 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700" title="Open WhatsApp chat" aria-label={`WhatsApp ${r.fullName}`}><MessageCircle className="h-3.5 w-3.5" /></a>
                        {!r.patient && (
                          <Link href={`/patients/new?${new URLSearchParams({ name: r.fullName, mobile: r.mobile, reason: r.enquiry ?? "" })}`}
                            className="rounded p-1 text-gray-500 hover:bg-violet-50 hover:text-violet-700" title="Register as patient" aria-label={`Register ${r.fullName} as patient`}><UserPlus className="h-3.5 w-3.5" /></Link>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[140px]">
                      <EditableCell label={`Enquiry for ${r.fullName}`} value={r.enquiry} placeholder="Add enquiry" list="lead-treatments" onSave={(v) => update(r.id, { enquiry: v })} />
                    </td>
                    <td className="py-2.5 px-3 min-w-[200px] max-w-[280px]">
                      <EditableCell label={`Last message for ${r.fullName}`} value={r.lastMessage} placeholder="Add last message" multiline onSave={(v) => update(r.id, { lastMessage: v })} />
                      {r.lastMessagedAt && <span className="block text-[11px] text-gray-400">Template sent {fmtDate(r.lastMessagedAt)} ({r.messageCount})</span>}
                    </td>
                    <td className={`py-2.5 px-3 whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : ""}`}>
                      <EditableCell label={`Follow-up for ${r.fullName}`} value={r.followUpOn} display={r.followUpOn ? fmtDate(r.followUpOn) : null} placeholder="Set date" type="date" onSave={(v) => update(r.id, { followUpOn: v || null })} />
                    </td>
                    <td className="py-2.5 px-3">
                      <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value as LeadStatus })} disabled={pending}
                        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border-0 ${STATUS_CLS[r.status]}`} aria-label={`Status of ${r.fullName}`}>
                        {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <button type="button" onClick={() => update(r.id, { whatsappOptIn: !r.whatsappOptIn })} disabled={pending}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.whatsappOptIn ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                        title="Click to change opt-in">
                        {r.whatsappOptIn ? "Opted in" : "No opt-in"}
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <datalist id="lead-treatments">{treatments.map((t) => <option key={t} value={t} />)}</datalist>
        {editing && <EditLeadDialog lead={editing} onClose={() => setEditing(null)} />}

        {total > pageSize && (
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 text-sm text-gray-600">
            <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString("en-IN")}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page * pageSize >= total} onClick={() => go({ page: String(page + 1) })}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ImportDialog() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState("")
  const [table, setTable] = useState<string[][]>([])
  const [optIn, setOptIn] = useState(false)
  const [source, setSource] = useState("")
  const [result, setResult] = useState<{ created: number; updated: number; skipped: { row: number; reason: string }[] } | null>(null)
  const [pending, start] = useTransition()

  const header = useMemo(() => table[0] ?? [], [table])
  const cols = useMemo(() => mapColumns(header), [header])
  const body = table.slice(1)
  const ready = cols.fullName !== undefined && cols.mobile !== undefined && body.length > 0

  async function onFile(f: File | undefined) {
    if (!f) return
    setResult(null)
    setFileName(f.name)
    setTable(parseCsv(await f.text()))
  }

  function doImport() {
    const rows = body.map((r) => Object.fromEntries(Object.entries(cols).map(([field, idx]) => [field, (r[idx] ?? "").trim()])))
    start(async () => {
      const res = await importPotentialClientsAction(rows, optIn, source)
      if ("error" in res && res.error) { toast.error(res.error); return }
      if ("created" in res) {
        setResult({ created: res.created, updated: res.updated, skipped: res.skipped })
        toast.success(`Imported: ${res.created} new, ${res.updated} updated`)
        router.refresh()
      }
    })
  }

  function reset() { setTable([]); setFileName(""); setResult(null); setOptIn(false); setSource(""); if (fileRef.current) fileRef.current.value = "" }

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true) }} className="h-9 gap-1.5 text-white" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
        <Upload className="h-4 w-4" /> Import CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import potential clients</DialogTitle>
            <p className="text-xs text-gray-500">CSV with a header row. Needs a <strong>Name</strong> and a <strong>Mobile</strong> column; Email, Area/City, Source and Notes are picked up if present. Existing mobiles are updated, not duplicated.</p>
          </DialogHeader>

          <label className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-6 cursor-pointer hover:border-[#005E97] hover:bg-sky-50/30">
            <FileUp className="h-7 w-7 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{fileName || "Choose a .csv file"}</span>
            <span className="text-xs text-gray-400">{body.length ? `${body.length.toLocaleString("en-IN")} rows found` : "Excel: File → Save As → CSV"}</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          {header.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {Object.keys(FIELD_ALIASES).map((f) => (
                  <span key={f} className={`px-2 py-0.5 rounded-full ${cols[f] !== undefined ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                    {f === "fullName" ? "Name" : f[0].toUpperCase() + f.slice(1)}: {cols[f] !== undefined ? `“${header[cols[f]]}”` : "not found"}
                  </span>
                ))}
              </div>
              {!ready && <p className="text-sm text-red-600">Couldn&apos;t find a Name and a Mobile column — rename the header row and try again.</p>}
              {ready && (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr>{["Name", "Mobile", "Area", "Source"].map((h) => <th key={h} className="text-left px-2 py-1.5 font-semibold text-gray-500">{h}</th>)}</tr></thead>
                    <tbody>
                      {body.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-2 py-1.5">{r[cols.fullName]}</td>
                          <td className="px-2 py-1.5 font-mono">{r[cols.mobile]}</td>
                          <td className="px-2 py-1.5">{cols.area !== undefined ? r[cols.area] : ""}</td>
                          <td className="px-2 py-1.5">{cols.source !== undefined ? r[cols.source] : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {body.length > 5 && <p className="px-2 py-1 text-[11px] text-gray-400">…and {body.length - 5} more</p>}
                </div>
              )}
              <Input value={source} onChange={(e) => setSource(e.target.value)} maxLength={100} placeholder="Source for rows without one (e.g. Health camp — Salt Lake)" className="h-9" />
              <label className="flex items-start gap-2 text-sm rounded-lg bg-amber-50 p-3 text-amber-900 cursor-pointer">
                <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>These people agreed to receive WhatsApp messages from Ur&apos;s Toothfully.
                  <span className="block text-xs text-amber-700">Leave unticked if unsure — they&apos;re imported but won&apos;t be messaged until marked opted-in. Messaging people who didn&apos;t agree can get the WhatsApp number blocked.</span>
                </span>
              </label>
            </>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">{result.created} added · {result.updated} updated · {result.skipped.length} skipped</p>
              {result.skipped.length > 0 && (
                <ul className="mt-1 max-h-28 overflow-y-auto text-xs text-emerald-800">
                  {result.skipped.slice(0, 50).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{result ? "Close" : "Cancel"}</Button>
            {!result && (
              <Button onClick={doImport} disabled={!ready || pending} className="text-white" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
                {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : `Import ${body.length.toLocaleString("en-IN")} rows`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddLeadDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const empty = { fullName: "", mobile: "", area: "", source: "", notes: "", enquiry: "", lastMessage: "" }
  const [f, setF] = useState(empty)
  const [optIn, setOptIn] = useState(false)
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      const res = await addPotentialClientAction(f, optIn)
      if (res.error) { toast.error(res.error); return }
      toast.success("Potential client added")
      setOpen(false); setF(empty); setOptIn(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-9 gap-1.5"><Plus className="h-4 w-4" /> Add</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add potential client</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder="Name" className="h-9" maxLength={200} />
            <Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="Mobile" className="h-9" maxLength={15} />
            <Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Area / city (optional)" className="h-9" maxLength={150} />
            <Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Source (optional)" className="h-9" maxLength={100} />
            <Input value={f.enquiry} onChange={(e) => setF({ ...f, enquiry: e.target.value })} placeholder="Treatment enquiry (e.g. Implants, Braces)" className="h-9" maxLength={200} list="lead-treatments" aria-label="Treatment enquiry" />
            <textarea value={f.lastMessage} onChange={(e) => setF({ ...f, lastMessage: e.target.value })} placeholder="Last message / conversation (optional)" rows={2} maxLength={1000} aria-label="Last message" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
            <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Notes (optional)" className="h-9" maxLength={500} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="h-4 w-4" /> Agreed to WhatsApp messages
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={pending} className="text-white bg-[#005E97] hover:bg-[#00507f]">{pending ? "Saving…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SendDialog({ ids, templates, optedInSelected, onDone }: { ids: string[]; templates: TemplateView[]; optedInSelected: number; onDone: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState("")
  const [values, setValues] = useState<string[]>([])
  const [pending, start] = useTransition()
  const t = templates.find((x) => x.id === templateId)

  function pick(id: string) {
    setTemplateId(id)
    const tpl = templates.find((x) => x.id === id)
    setValues(tpl ? tpl.variables.map((v) => (/name/i.test(v) ? "{name}" : "")) : [])
  }

  function send() {
    start(async () => {
      const res = await sendPotentialClientsWhatsAppAction(ids, templateId, values)
      if ("error" in res && res.error) { toast.error(res.error); return }
      if ("sent" in res) {
        toast.success(`Queued ${res.sent} message${res.sent === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped (no opt-in)` : ""}`)
        if (res.failed.length) toast.error(`${res.failed.length} failed: ${res.failed[0]}`)
        setOpen(false); onDone(); router.refresh()
      }
    })
  }

  return (
    <>
      <Button size="sm" className="h-8 gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
        <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send WhatsApp to {ids.length} selected</DialogTitle>
            <p className="text-xs text-gray-500">{optedInSelected} of the selected on this page opted in — the rest are skipped automatically.</p>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-600">No approved templates yet. Create one under <Link href="/whatsapp/templates" className="text-[#005E97] underline">WhatsApp → Templates</Link> and wait for Meta&apos;s approval.</p>
          ) : (
            <div className="space-y-3">
              <select value={templateId} onChange={(e) => pick(e.target.value)} className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm bg-white">
                <option value="">Choose an approved template…</option>
                {templates.map((x) => <option key={x.id} value={x.id}>{x.displayName} ({x.category.toLowerCase()})</option>)}
              </select>
              {t && t.variables.map((label, i) => (
                <label key={i} className="block space-y-1">
                  <span className="text-xs font-medium text-gray-700">{`{{${i + 1}}}`} {label}</span>
                  <Input value={values[i] ?? ""} onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))} className="h-9" />
                </label>
              ))}
              {t && (
                <>
                  <p className="text-[11px] text-gray-500">Use <code className="px-1 rounded bg-gray-100">{"{name}"}</code> to insert each person&apos;s first name.</p>
                  <div className="rounded-xl bg-[#E7F8EE] p-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {renderTemplateBody(t.body, values.map((v) => v.replaceAll("{name}", "Priya")))}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={!t || pending || values.some((v) => !v.trim())} className="text-white bg-emerald-600 hover:bg-emerald-700">
              {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Queuing…</> : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Double-click to edit in place. Enter saves (Ctrl+Enter for multi-line),
 * Esc cancels, clicking away saves. Blank clears the field.
 */
function EditableCell({ value, display, placeholder, onSave, type = "text", multiline, list, label }: {
  value: string | null; display?: string | null; placeholder: string; onSave: (v: string) => void
  type?: "text" | "date"; multiline?: boolean; list?: string; label: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const begin = () => { setDraft(value ?? ""); setEditing(true) }
  const commit = () => { setEditing(false); if (draft.trim() !== (value ?? "")) onSave(draft.trim()) }
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setEditing(false) }
    if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) { e.preventDefault(); commit() }
  }
  if (editing)
    return multiline ? (
      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={keys} rows={3} maxLength={1000}
        aria-label={label} className="w-full rounded border border-[#005E97] px-2 py-1 text-xs outline-none" />
    ) : (
      <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={keys} list={list}
        maxLength={200} aria-label={label} className="w-full rounded border border-[#005E97] px-2 py-1 text-xs outline-none" />
    )
  return (
    <span onDoubleClick={begin} title="Double-click to edit" role="button" tabIndex={0} aria-label={label}
      onKeyDown={(e) => { if (e.key === "Enter") begin() }}
      className={`block cursor-text rounded px-1 -mx-1 text-xs hover:bg-gray-100 ${value ? "text-gray-700 whitespace-pre-wrap line-clamp-3" : "text-gray-300 italic"}`}>
      {display ?? value ?? placeholder}
    </span>
  )
}

/** Everything about one lead in one popup (double-click the name). */
function EditLeadDialog({ lead, onClose }: { lead: LeadRowView; onClose: () => void }) {
  const router = useRouter()
  const [f, setF] = useState({
    fullName: lead.fullName, area: lead.area ?? "", source: lead.source ?? "", notes: lead.notes ?? "",
    enquiry: lead.enquiry ?? "", lastMessage: lead.lastMessage ?? "", followUpOn: lead.followUpOn ?? "",
    status: lead.status, whatsappOptIn: lead.whatsappOptIn,
  })
  const [pending, start] = useTransition()
  function save() {
    start(async () => {
      const res = await updatePotentialClientAction(lead.id, { ...f, followUpOn: f.followUpOn || null })
      if (res.error) return void toast.error(res.error)
      toast.success("Saved")
      onClose()
      router.refresh()
    })
  }
  const field = "h-9 w-full rounded-md border border-gray-200 px-3 text-sm"
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lead.fullName} · {lead.mobile}</DialogTitle></DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-gray-700">Name</span>
            <input className={field} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} maxLength={200} /></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-gray-700">Treatment enquiry</span>
            <input className={field} value={f.enquiry} onChange={(e) => setF({ ...f, enquiry: e.target.value })} list="lead-treatments" maxLength={200} placeholder="e.g. Implants, Braces, RCT" /></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-gray-700">Last message</span>
            <textarea className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" rows={3} value={f.lastMessage} onChange={(e) => setF({ ...f, lastMessage: e.target.value })} maxLength={1000} placeholder="What was last said to / by them" /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-700">Follow-up on</span>
            <input type="date" className={field} value={f.followUpOn} onChange={(e) => setF({ ...f, followUpOn: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-700">Status</span>
            <select className={field} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as LeadStatus })}>
              {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-700">Area</span>
            <input className={field} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} maxLength={150} /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-700">Source</span>
            <input className={field} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} maxLength={100} /></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-gray-700">Notes</span>
            <input className={field} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={f.whatsappOptIn} onChange={(e) => setF({ ...f, whatsappOptIn: e.target.checked })} className="h-4 w-4" /> Agreed to WhatsApp messages
          </label>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {!lead.patient && (
            <Link href={`/patients/new?${new URLSearchParams({ name: f.fullName, mobile: lead.mobile, reason: f.enquiry })}`}
              className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-violet-200 px-3 text-sm font-medium text-violet-700 hover:bg-violet-50">
              <UserPlus className="h-4 w-4" /> Register as patient
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={pending || !f.fullName.trim()} className="text-white bg-[#005E97] hover:bg-[#00507f]">{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
