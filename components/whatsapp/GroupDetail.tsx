"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Pencil, Search, Send, Trash2, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageStatusBadge } from "@/components/whatsapp/MessageStatusBadge"
import { renderTemplateBody } from "@/lib/whatsapp/templates"
import {
  addGroupMembersAction, addGroupMembersByCodesAction, deleteGroupAction,
  removeGroupMemberAction, sendGroupMessageAction, updateGroupAction,
} from "@/actions/whatsapp-groups"

export interface GroupMemberView { patientId: string; code: string; name: string; mobile: string; consent: boolean; addedAt: string }
export interface GroupLogView {
  id: string; template: string; status: string; createdAt: string; sentAt: string | null
  failureReason: string | null; patient: { id: string; name: string; code: string } | null; sentBy: string
}
export interface TemplateOption { id: string; displayName: string; body: string; category: string; variables: string[] }

const fmtDT = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

export function GroupDetail({ group, members, log, templates, isAdmin }: {
  group: { id: string; name: string; description: string | null; createdBy: string }
  members: GroupMemberView[]
  log: GroupLogView[]
  templates: TemplateOption[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<"members" | "send" | "log">("members")
  const consented = members.filter((m) => m.consent).length

  // ── Rename ──
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? "")
  function saveName() {
    start(async () => {
      const res = await updateGroupAction(group.id, { name, description })
      if ("error" in res && res.error) return void toast.error(res.error)
      setEditing(false)
      router.refresh()
    })
  }
  function removeGroup() {
    if (!window.confirm(`Delete the group "${group.name}"? Its message log stays in WhatsApp → Message Logs.`)) return
    start(async () => {
      const res = await deleteGroupAction(group.id)
      if ("error" in res && res.error) return void toast.error(res.error)
      toast.success("Group deleted")
      router.push("/whatsapp/groups")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/whatsapp/groups" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-3.5 w-3.5" /> All groups
          </Link>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-64" maxLength={100} aria-label="Group name" />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 w-72" maxLength={300} placeholder="Description" aria-label="Group description" />
              <Button size="sm" onClick={saveName} disabled={pending}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          ) : (
            <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              {group.name}
              <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Rename">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </h2>
          )}
          {group.description && !editing && <p className="text-sm text-gray-500">{group.description}</p>}
          <p className="mt-1 text-xs text-gray-500">
            {members.length} patient{members.length === 1 ? "" : "s"} · {consented} can receive WhatsApp · created by {group.createdBy}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="text-red-600" onClick={removeGroup} disabled={pending}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete group
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200" role="tablist">
        {([["members", `Patients (${members.length})`], ["send", "Send message"], ["log", `Log (${log.length})`]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "members" && <Members groupId={group.id} members={members} />}
      {tab === "send" && <SendPanel groupId={group.id} templates={templates} total={members.length} consented={consented} onSent={() => setTab("log")} />}
      {tab === "log" && <LogTable log={log} />}
    </div>
  )
}

function Members({ groupId, members }: { groupId: string; members: GroupMemberView[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<{ id: string; fullName: string; patientId: string; mobile: string }[]>([])
  const [paste, setPaste] = useState("")
  const [filter, setFilter] = useState("")
  const [removed, setRemoved] = useState<Set<string>>(new Set()) // hide instantly, before the refresh lands
  const inGroup = new Set(members.map((m) => m.patientId))

  const search = useDebouncedCallback(async (term: string) => {
    if (term.trim().length < 2) return setHits([])
    const res = await fetch(`/api/patients?q=${encodeURIComponent(term.trim())}`)
    const data = await res.json().catch(() => ({}))
    setHits((data.patients ?? []).slice(0, 8))
  }, 250)

  function add(ids: string[]) {
    start(async () => {
      const res = await addGroupMembersAction(groupId, ids)
      if ("error" in res && res.error) return void toast.error(res.error)
      if ("added" in res) toast.success(res.added ? `Added ${res.added}` : "Already in the group")
      router.refresh()
    })
  }
  function addPasted() {
    start(async () => {
      const res = await addGroupMembersByCodesAction(groupId, paste)
      if ("error" in res && res.error) return void toast.error(res.error)
      if ("added" in res) {
        toast.success(`Added ${res.added} (${res.matched} matched)`)
        if (res.notFound.length) toast.error(`Not found: ${res.notFound.slice(0, 5).join(", ")}${res.notFound.length > 5 ? "…" : ""}`)
        setPaste("")
      }
      router.refresh()
    })
  }
  function remove(patientId: string) {
    setRemoved((s) => new Set(s).add(patientId))
    start(async () => {
      await removeGroupMemberAction(groupId, patientId)
      router.refresh()
    })
  }

  const visible = members.filter((m) => !removed.has(m.patientId))
  const shown = filter ? visible.filter((m) => `${m.name} ${m.code} ${m.mobile}`.toLowerCase().includes(filter.toLowerCase())) : visible

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl bg-white ring-1 ring-black/5">
        <div className="flex items-center gap-2 border-b border-gray-100 p-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter members" className="flex-1 text-sm outline-none" aria-label="Filter members" />
        </div>
        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{members.length ? "No match." : "No patients yet — add some on the right."}</p>
        ) : (
          <ul className="max-h-[520px] divide-y divide-gray-50 overflow-y-auto">
            {shown.map((m) => (
              <li key={m.patientId} className="flex items-center justify-between gap-3 px-3 py-2">
                <Link href={`/patients/${m.patientId}`} className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.code} · {m.mobile}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.consent ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                    title={m.consent ? "Has WhatsApp consent" : "No WhatsApp consent — will be skipped"}>
                    {m.consent ? "Consent" : "No consent"}
                  </span>
                  <button type="button" onClick={() => remove(m.patientId)} disabled={pending} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${m.name}`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800"><UserPlus className="h-4 w-4" /> Add a patient</p>
          <Input value={q} onChange={(e) => { setQ(e.target.value); search(e.target.value) }} placeholder="Search name, mobile or ID" className="h-9" aria-label="Search patients to add" />
          {hits.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-50 rounded-md border border-gray-100">
              {hits.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="min-w-0 truncate text-sm">{p.fullName} <span className="text-xs text-gray-400">{p.patientId}</span></span>
                  {inGroup.has(p.id) ? (
                    <span className="text-[11px] text-gray-400">Added</span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending} onClick={() => add([p.id])}>Add</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
          <p className="text-sm font-semibold text-gray-800">Add many at once</p>
          <p className="mb-2 text-xs text-gray-500">Paste mobile numbers or patient IDs — one per line or comma-separated.</p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} className="w-full rounded-md border border-gray-200 p-2 text-sm" placeholder={"9876543210\nPT-2026-0012"} aria-label="Paste mobiles or patient IDs" />
          <Button size="sm" className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={pending || !paste.trim()} onClick={addPasted}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to group"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SendPanel({ groupId, templates, total, consented, onSent }: {
  groupId: string; templates: TemplateOption[]; total: number; consented: number; onSent: () => void
}) {
  const router = useRouter()
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
    if (!window.confirm(`Send "${t?.displayName}" to ${consented} patient${consented === 1 ? "" : "s"}?`)) return
    start(async () => {
      const res = await sendGroupMessageAction(groupId, templateId, values)
      if ("error" in res && res.error) return void toast.error(res.error)
      if ("sent" in res) {
        toast.success(`Queued ${res.sent}${res.skipped ? ` · ${res.skipped} skipped (no consent)` : ""}`)
        if (res.failed.length) toast.error(`${res.failed.length} failed: ${res.failed[0]}`)
        router.refresh()
        onSent()
      }
    })
  }

  if (templates.length === 0)
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-gray-600 ring-1 ring-black/5">
        No approved templates yet. Create a <b>Marketing</b> or <b>Utility</b> template under{" "}
        <Link href="/whatsapp/templates" className="text-emerald-700 underline">Templates</Link> and wait for Meta&apos;s approval.
      </p>
    )

  return (
    <div className="grid gap-4 rounded-xl bg-white p-4 ring-1 ring-black/5 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-700">Template</span>
          <select value={templateId} onChange={(e) => pick(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm" aria-label="Template">
            <option value="">Choose an approved template…</option>
            {templates.map((x) => <option key={x.id} value={x.id}>{x.displayName} ({x.category.toLowerCase()})</option>)}
          </select>
        </label>
        {t?.variables.map((label, i) => (
          <label key={i} className="block space-y-1">
            <span className="text-xs font-medium text-gray-700">{`{{${i + 1}}}`} {label}</span>
            <Input value={values[i] ?? ""} onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))} className="h-9" />
          </label>
        ))}
        {t && <p className="text-[11px] text-gray-500">Use <code className="rounded bg-gray-100 px-1">{"{name}"}</code> for each patient&apos;s first name.</p>}
        <p className="text-xs text-gray-600">
          Goes to <b>{consented}</b> of {total} patients. {total - consented > 0 && `${total - consented} without WhatsApp consent are skipped.`}
        </p>
        <Button onClick={send} disabled={!t || pending || consented === 0 || values.some((v) => !v.trim())} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to group
        </Button>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-gray-700">Preview</p>
        <div className="min-h-[120px] whitespace-pre-wrap rounded-xl bg-[#E7F8EE] p-3 text-sm text-gray-800">
          {t ? renderTemplateBody(t.body, values.map((v) => v.replaceAll("{name}", "Priya"))) : "Pick a template to preview it."}
        </div>
      </div>
    </div>
  )
}

function LogTable({ log }: { log: GroupLogView[] }) {
  if (log.length === 0) return <p className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 ring-1 ring-black/5">Nothing sent to this group yet.</p>
  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-black/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2">When</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Template</th>
            <th className="px-3 py-2">Status</th><th className="px-3 py-2">Sent by</th>
          </tr>
        </thead>
        <tbody>
          {log.map((r) => (
            <tr key={r.id} className="border-b border-gray-50">
              <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{fmtDT(r.createdAt)}</td>
              <td className="px-3 py-2">{r.patient ? <Link href={`/patients/${r.patient.id}`} className="hover:underline">{r.patient.name}</Link> : "—"}</td>
              <td className="px-3 py-2 text-xs">{r.template}</td>
              <td className="px-3 py-2" title={r.failureReason ?? undefined}><MessageStatusBadge status={r.status} /></td>
              <td className="px-3 py-2 text-xs text-gray-600">{r.sentBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
