"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteCampaignAction, saveCampaignAction, setCampaignActiveAction } from "@/actions/rewards"
import { CAMPAIGN_THEMES, REWARD_KINDS, isDiscountKind, rewardText, themeOf, type CampaignStatus, type RewardKind } from "@/lib/rewards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarDays, Copy, Gift, Loader2, Megaphone, Pause, Pencil, Play, Plus, Trash2, UserPlus } from "lucide-react"

export interface CampaignView {
  id: string
  name: string
  tagline: string | null
  referrerOffer: string
  refereeOffer: string
  referrerKind: RewardKind
  referrerValue: number | null
  refereeKind: RewardKind
  refereeValue: number | null
  terms: string | null
  startsAt: string // YYYY-MM-DD
  endsAt: string | null
  isActive: boolean
  theme: string
  status: CampaignStatus
  rewardsGiven: number
}

type Form = Omit<CampaignView, "id" | "status" | "rewardsGiven" | "referrerValue" | "refereeValue" | "tagline" | "terms" | "endsAt"> & {
  tagline: string; terms: string; endsAt: string; referrerValue: string; refereeValue: string
}

const STATUS_STYLE: Record<CampaignStatus, { label: string; bg: string; fg: string; dot: string }> = {
  LIVE: { label: "Live", bg: "rgba(16,185,129,0.18)", fg: "#ECFDF5", dot: "#34D399" },
  SCHEDULED: { label: "Scheduled", bg: "rgba(255,255,255,0.18)", fg: "#F8FAFC", dot: "#FCD34D" },
  PAUSED: { label: "Paused", bg: "rgba(0,0,0,0.25)", fg: "#F1F5F9", dot: "#CBD5E1" },
  ENDED: { label: "Ended", bg: "rgba(0,0,0,0.3)", fg: "#E2E8F0", dot: "#94A3B8" },
}

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())

function emptyForm(): Form {
  return {
    name: "", tagline: "", referrerOffer: "", refereeOffer: "",
    referrerKind: "DISCOUNT_FLAT", referrerValue: "", refereeKind: "FREE_CHECKUP", refereeValue: "",
    terms: "", startsAt: today(), endsAt: "", isActive: true, theme: "teal",
  }
}
function toForm(c: CampaignView, copy = false): Form {
  return {
    name: copy ? `${c.name} (copy)` : c.name, tagline: c.tagline ?? "", referrerOffer: c.referrerOffer, refereeOffer: c.refereeOffer,
    referrerKind: c.referrerKind, referrerValue: c.referrerValue ? String(c.referrerValue) : "",
    refereeKind: c.refereeKind, refereeValue: c.refereeValue ? String(c.refereeValue) : "",
    terms: c.terms ?? "", startsAt: copy ? today() : c.startsAt, endsAt: copy ? "" : c.endsAt ?? "", isActive: c.isActive, theme: c.theme,
  }
}

function CampaignCard({ c, preview, onEdit, onCopy }: { c: Pick<CampaignView, "name" | "tagline" | "referrerOffer" | "refereeOffer" | "startsAt" | "endsAt" | "theme" | "status"> & Partial<CampaignView>; preview?: boolean; onEdit?: () => void; onCopy?: () => void }) {
  const t = themeOf(c.theme)
  const s = STATUS_STYLE[c.status]
  const router = useRouter()
  const [pending, start] = useTransition()

  function toggle() {
    start(async () => {
      const res = await setCampaignActiveAction(c.id!, !c.isActive)
      if (res.success) { toast.success(c.isActive ? "Campaign paused" : "Campaign resumed"); router.refresh() } else toast.error(res.error ?? "Failed")
    })
  }
  function remove() {
    if (!window.confirm(`Delete "${c.name}"? This can't be undone.`)) return
    start(async () => {
      const res = await deleteCampaignAction(c.id!)
      if (res.success) { toast.success("Campaign deleted"); router.refresh() } else toast.error(res.error ?? "Failed")
    })
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.18)] ring-1 ring-black/5 flex flex-col">
      <div className="relative px-5 pt-5 pb-6 text-white" style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)` }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #fff 0%, transparent 65%)" }} />
        <div className="pointer-events-none absolute right-6 bottom-3 opacity-15"><Gift className="h-16 w-16" /></div>
        <div className="relative flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.fg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} /> {s.label}
          </span>
          {!preview && <span className="text-[11px] text-white/80">{c.rewardsGiven ?? 0} reward{c.rewardsGiven === 1 ? "" : "s"} given</span>}
        </div>
        <h3 className="relative mt-3 text-xl font-bold leading-tight">{c.name || "Campaign name"}</h3>
        {c.tagline && <p className="relative mt-1 text-sm text-white/85">{c.tagline}</p>}
        <p className="relative mt-3 flex items-center gap-1.5 text-xs text-white/80">
          <CalendarDays className="h-3.5 w-3.5" /> {c.startsAt ? fmt(c.startsAt) : "—"} {c.endsAt ? `– ${fmt(c.endsAt)}` : "· no end date"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-100 flex-1">
        {([["Referrer gets", c.referrerOffer, Gift], ["New patient gets", c.refereeOffer, UserPlus]] as const).map(([title, offer, Icon]) => (
          <div key={title} className="bg-white p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.ink }}>
              <Icon className="h-3.5 w-3.5" /> {title}
            </p>
            <p className="mt-1.5 text-sm font-medium text-gray-900 leading-snug">{offer || "—"}</p>
          </div>
        ))}
      </div>

      {!preview && (
        <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-100 bg-gray-50/60">
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-gray-700" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          {c.status !== "ENDED" && (
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-gray-700" onClick={toggle} disabled={pending}>
              {c.isActive ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-gray-700" onClick={onCopy}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
          <Button size="sm" variant="ghost" className="h-8 ml-auto text-red-600 hover:text-red-700 hover:bg-red-50" onClick={remove} disabled={pending} aria-label="Delete campaign">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function SidePicker({ label, kind, value, offer, onKind, onValue, onOffer }: {
  label: string; kind: RewardKind; value: string; offer: string
  onKind: (k: RewardKind) => void; onValue: (v: string) => void; onOffer: (o: string) => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-800">{label}</p>
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => onKind(e.target.value as RewardKind)} className="h-9 flex-1 rounded-md border border-gray-200 px-2 text-sm bg-white">
          {REWARD_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        {isDiscountKind(kind) && (
          <Input type="number" min={0} value={value} onChange={(e) => onValue(e.target.value)} className="h-9 w-24" placeholder={kind === "DISCOUNT_PERCENT" ? "%" : "₹"} />
        )}
      </div>
      <Input value={offer} onChange={(e) => onOffer(e.target.value)} maxLength={300} className="h-9" placeholder="Offer shown to patients, e.g. ₹500 off your next treatment" />
    </div>
  )
}

export function CampaignManager({ campaigns }: { campaigns: CampaignView[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [f, setF] = useState<Form>(emptyForm)
  const [saving, start] = useTransition()
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))

  function openNew() { setEditId(null); setF(emptyForm()); setOpen(true) }
  function openEdit(c: CampaignView) { setEditId(c.id); setF(toForm(c)); setOpen(true) }
  function openCopy(c: CampaignView) { setEditId(null); setF(toForm(c, true)); setOpen(true) }

  // Picking a reward type writes a sensible offer line if the admin hasn't typed one.
  function autoOffer(kind: RewardKind, value: string, current: string) {
    if (current.trim()) return current
    return kind === "OTHER" ? "" : rewardText(kind, Number(value) || 0)
  }

  function save() {
    start(async () => {
      const res = await saveCampaignAction(editId, {
        ...f,
        referrerValue: f.referrerValue ? Number(f.referrerValue) : null,
        refereeValue: f.refereeValue ? Number(f.refereeValue) : null,
      })
      if (res.success) { toast.success(editId ? "Campaign updated" : "Campaign created"); setOpen(false); router.refresh() }
      else toast.error(res.error ?? "Failed to save")
    })
  }

  const previewStatus: CampaignStatus = (() => {
    const d = today()
    if (f.endsAt && d > f.endsAt) return "ENDED"
    if (!f.isActive) return "PAUSED"
    return d < f.startsAt ? "SCHEDULED" : "LIVE"
  })()

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Megaphone className="h-5 w-5 text-[#005E97]" /> Campaigns</h2>
          <p className="text-sm text-gray-500">Offers for both the patient who refers and the friend they bring. Several can run at once.</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 text-white shadow-sm" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <button onClick={openNew} className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center hover:border-[#005E97] hover:bg-[#005E97]/[0.02] transition-colors">
          <Gift className="h-10 w-10 mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-800">Create your first campaign</p>
          <p className="text-sm text-gray-500">e.g. &ldquo;Refer a friend — you get ₹500 off, they get a free check-up&rdquo;</p>
        </button>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => <CampaignCard key={c.id} c={c} onEdit={() => openEdit(c)} onCopy={() => openCopy(c)} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[1fr_320px]">
            <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit campaign" : "New campaign"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-2">
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="Campaign name — e.g. Diwali Smile Referral" className="h-10 font-medium" />
                <Input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={200} placeholder="Tagline (optional) — e.g. Share a smile, both of you save" className="h-9" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <SidePicker
                  label="The patient who refers gets" kind={f.referrerKind} value={f.referrerValue} offer={f.referrerOffer}
                  onKind={(k) => setF((p) => ({ ...p, referrerKind: k, referrerOffer: autoOffer(k, p.referrerValue, p.referrerOffer) }))}
                  onValue={(v) => set("referrerValue", v)} onOffer={(o) => set("referrerOffer", o)}
                />
                <SidePicker
                  label="The new patient gets" kind={f.refereeKind} value={f.refereeValue} offer={f.refereeOffer}
                  onKind={(k) => setF((p) => ({ ...p, refereeKind: k, refereeOffer: autoOffer(k, p.refereeValue, p.refereeOffer) }))}
                  onValue={(v) => set("refereeValue", v)} onOffer={(o) => set("refereeOffer", o)}
                />
              </div>
              <p className="text-[11px] text-gray-500 -mt-2">The reward type and amount pre-fill the doctor&apos;s &ldquo;Use points&rdquo; form — the doctor can still change it.</p>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Starts</span>
                  <Input type="date" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="h-9" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Ends (optional)</span>
                  <Input type="date" value={f.endsAt} min={f.startsAt} onChange={(e) => set("endsAt", e.target.value)} className="h-9" />
                </label>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-700">Card colour</span>
                <div className="mt-1.5 flex gap-2">
                  {Object.entries(CAMPAIGN_THEMES).map(([key, t]) => (
                    <button key={key} type="button" onClick={() => set("theme", key)} aria-label={`${key} theme`}
                      className="h-8 w-8 rounded-full ring-offset-2 transition-shadow"
                      style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: f.theme === key ? `0 0 0 2px white, 0 0 0 4px ${t.from}` : undefined }} />
                  ))}
                </div>
              </div>

              <Textarea value={f.terms} onChange={(e) => set("terms", e.target.value)} maxLength={1000} rows={3} placeholder="Terms (optional) — e.g. Valid on treatments above ₹2,000. One reward per visit." />

              <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4" />
                Active (uncheck to save as paused)
              </label>
            </div>

            <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-5 border-l border-gray-200 flex flex-col">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Live preview</p>
              <CampaignCard preview c={{ name: f.name, tagline: f.tagline || null, referrerOffer: f.referrerOffer, refereeOffer: f.refereeOffer, startsAt: f.startsAt, endsAt: f.endsAt || null, theme: f.theme, status: previewStatus }} />
              {f.terms && <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">{f.terms}</p>}
              <DialogFooter className="mt-auto pt-5 gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving} className="text-white" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : editId ? "Save changes" : "Create campaign"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
