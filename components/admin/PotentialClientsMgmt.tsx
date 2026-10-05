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
import { CheckCircle2, Download, FileUp, Loader2, MessageCircle, Plus, Search, Trash2, Upload, UserCheck, Users } from "lucide-react"

type LeadStatus = "NEW" | "CONTACTED" | "CONVERTED" | "NOT_INTERESTED"
const STATUS_LABEL: Record<LeadStatus, string> = { NEW: "New", CONTACTED: "Contacted", CONVERTED: "Converted", NOT_INTERESTED: "Not interested" }
const STATUS_CLS: Record<LeadStatus, string> = {
  NEW: "bg-sky-50 text-sky-700", CONTACTED: "bg-amber-50 text-amber-700", CONVERTED: "bg-emerald-50 text-emerald-700", NOT_INTERESTED: "bg-gray-100 text-gray-600",
}

export interface LeadRowView {
  id: string; fullName: string; mobile: string; email: string | null; area: string | null; source: string | null; notes: string | null
  whatsappOptIn: boolean; status: LeadStatus; messageCount: number; lastMessagedAt: string | null; createdAt: string
  patient: { id: string; patientId: string } | null
}
interface TemplateView { id: string; displayName: string; body: string; category: string; variables: string[] }

// CSV header → field. First match wins; matching ignores case/spaces/punctuation.
const FIELD_ALIASES: Record<string, string[]> = {
  fullName: ["name", "fullname", "patientname", "clientname", "customername", "leadname"],
  mobile: ["mobile", "mobileno", "mobilenumber", "phone", "phoneno", "phonenumber", "contact", "contactno", "contactnumber", "whatsapp", "whatsappnumber", "number"],
  email: ["email", "emailid", "emailaddress", "mail"],
  area: ["area", "city", "location", "locality", "address", "place"],
  source: ["source", "leadsource", "campaign", "channel"],
  notes: ["notes", "note", "remarks", "remark", "comment", "comments"],
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

export function PotentialClientsMgmt({ rows, total, page, pageSize, counts, optedIn, filters, templates }: {
  rows: LeadRowView[]; total: number; page: number; pageSize: number
  counts: Partial<Record<LeadStatus, number>>; optedIn: number
  filters: { q: string; status: string; optin: string }; templates: TemplateView[]
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
    for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k))
    if (!("page" in patch)) p.delete("page")
    router.push(`${pathname}?${p.toString()}`)
  }

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s)
      for (const r of rows) (allOnPage ? n.delete(r.id) : n.add(r.id))
      return n
    })
  }
  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); (n.has(id) ? n.delete(id) : n.add(id)); return n })
  }

  function update(id: string, data: { status?: LeadStatus; whatsappOptIn?: boolean }) {
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

  const stats = [
    { label: "Potential clients", value: allTotal, icon: Users, cls: "text-[#005E97]" },
    { label: "WhatsApp opted-in", value: optedIn, icon: MessageCircle, cls: "text-emerald-600" },
    { label: "Contacted", value: counts.CONTACTED ?? 0, icon: CheckCircle2, cls: "text-amber-600" },
    { label: "Converted", value: counts.CONVERTED ?? 0, icon: UserCheck, cls: "text-violet-600" },
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="rounded-xl bg-white ring-1 ring-black/5 shadow-sm px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-500"><Icon className={`h-3.5 w-3.5 ${cls}`} /> {label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value.toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white ring-1 ring-black/5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
          <form onSubmit={(e) => { e.preventDefault(); go({ q }) }} className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, area" className="h-9 w-64 pl-8" />
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
            <p className="mt-3 font-medium text-gray-800">No potential clients {filters.q || filters.status || filters.optin ? "match these filters" : "yet"}</p>
            <p className="text-sm text-gray-500">Import a CSV with at least a name and a mobile column.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="w-10 px-3"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" className="h-4 w-4" /></th>
                  {["Name", "Mobile", "Area", "Source", "WhatsApp", "Status", "Last message"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-gray-50 ${selected.has(r.id) ? "bg-sky-50/50" : "hover:bg-gray-50/60"}`}>
                    <td className="px-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.fullName}`} className="h-4 w-4" /></td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-gray-900">{r.fullName}</span>
                      {r.patient && (
                        <Link href={`/patients/${r.patient.id}`} className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 hover:underline">
                          Patient {r.patient.patientId}
                        </Link>
                      )}
                      {r.notes && <span className="block text-xs text-gray-400 truncate max-w-[240px]">{r.notes}</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-700">{r.mobile}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{r.area ?? "—"}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{r.source ?? "—"}</td>
                    <td className="py-2.5 px-3">
                      <button type="button" onClick={() => update(r.id, { whatsappOptIn: !r.whatsappOptIn })} disabled={pending}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.whatsappOptIn ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                        title="Click to change opt-in">
                        {r.whatsappOptIn ? "Opted in" : "No opt-in"}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value as LeadStatus })} disabled={pending}
                        className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border-0 ${STATUS_CLS[r.status]}`} aria-label={`Status of ${r.fullName}`}>
                        {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">
                      {r.lastMessagedAt ? <>{fmtDate(r.lastMessagedAt)} <span className="text-gray-400">({r.messageCount})</span></> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

  const header = table[0] ?? []
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
  const [f, setF] = useState({ fullName: "", mobile: "", area: "", source: "", notes: "" })
  const [optIn, setOptIn] = useState(false)
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      const res = await addPotentialClientAction(f, optIn)
      if (res.error) { toast.error(res.error); return }
      toast.success("Potential client added")
      setOpen(false); setF({ fullName: "", mobile: "", area: "", source: "", notes: "" }); setOptIn(false)
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
