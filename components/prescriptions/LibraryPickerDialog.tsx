"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Plus, Search } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import type { LibraryResponse } from "@/app/api/clinical-library/route"
import { toast } from "sonner"

export interface LibraryItem {
  id: string
  name: string
  group: string
}

interface Props {
  title: string
  /** API returning a LibraryResponse — clinical-library or medicines. */
  endpoint: string
  /** Names already chosen, ticked in the list so nothing is added twice. */
  chosen?: string[]
  /** Fired per pick. The dialog stays open so several can be added in a row. */
  onPick: (item: LibraryItem) => void
  /** Enables "add <typed text>" when the search finds nothing. */
  onCreate?: (name: string) => Promise<void> | void
  createHint?: string
  onClose: () => void
}

export function LibraryPickerDialog({
  title,
  endpoint,
  chosen = [],
  onPick,
  onCreate,
  createHint,
  onClose,
}: Props) {
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [justPicked, setJustPicked] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(endpoint)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((json) => {
        // An error payload is an object, not the shape we expect — never let a
        // failed request reach .map() as if it were a list.
        if (cancelled) return
        setData({
          recent: Array.isArray(json?.recent) ? json.recent : [],
          mine: Array.isArray(json?.mine) ? json.mine : [],
          groups: Array.isArray(json?.groups) ? json.groups : [],
        })
      })
      .catch(() => {
        if (!cancelled) toast.error(`Could not load ${title.toLowerCase()}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [endpoint, title])

  const chosenSet = useMemo(
    () => new Set(chosen.map((c) => c.trim().toLowerCase())),
    [chosen]
  )

  const q = search.trim().toLowerCase()

  // Searching flattens the whole library into one ranked list; browsing keeps
  // the category grouping so the reference sheet's structure is recognisable.
  const sections = useMemo(() => {
    if (!data) return []
    if (q) {
      const seen = new Set<string>()
      const hits: LibraryItem[] = []
      for (const item of [
        ...data.recent,
        ...data.mine,
        ...data.groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group }))),
      ]) {
        if (seen.has(item.id) || !item.name.toLowerCase().includes(q)) continue
        seen.add(item.id)
        hits.push(item)
      }
      // Prefix matches first — typing "aug" should surface Augmentin, not bury it.
      hits.sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1
        return ap - bp || a.name.localeCompare(b.name)
      })
      return [{ label: `${hits.length} result${hits.length === 1 ? "" : "s"}`, items: hits }]
    }

    return [
      ...(data.recent.length ? [{ label: "Recently used", items: data.recent }] : []),
      ...(data.mine.length ? [{ label: "Added by your clinic", items: data.mine }] : []),
      ...data.groups.map((g) => ({
        label: g.group,
        items: g.items.map((i) => ({ ...i, group: g.group })),
      })),
    ]
  }, [data, q])

  const totalShown = sections.reduce((n, s) => n + s.items.length, 0)

  function handlePick(item: LibraryItem) {
    onPick(item)
    // Brief tick so it is obvious the click registered while the list stays open.
    setJustPicked(item.id)
    setTimeout(() => setJustPicked((cur) => (cur === item.id ? null : cur)), 900)
  }

  async function handleCreate() {
    if (!onCreate || !search.trim()) return
    setCreating(true)
    try {
      await onCreate(search.trim())
      setSearch("")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
          <Input
            autoFocus
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        {/* The scrollable list — fixed height so the box never jumps as you type. */}
        <div className="h-[22rem] overflow-y-auto rounded-lg border" style={{ borderColor: "#E0E3E5" }}>
          {loading ? (
            <p className="text-xs text-center py-8" style={{ color: BRAND_COLORS.borderDivider }}>
              Loading…
            </p>
          ) : totalShown === 0 ? (
            <div className="text-center py-8 px-4 space-y-3">
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                {q ? `No match for "${search.trim()}"` : "Nothing in this list yet"}
              </p>
              {onCreate && q && (
                <Button type="button" size="sm" variant="outline" onClick={handleCreate} disabled={creating}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {creating ? "Adding…" : `Add "${search.trim()}"`}
                </Button>
              )}
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.label}>
                <div
                  className="sticky top-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur"
                  style={{ color: BRAND_COLORS.primaryTeal, backgroundColor: "#F7F9FBEE" }}
                >
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const already = chosenSet.has(item.name.trim().toLowerCase())
                  const ticked = justPicked === item.id
                  return (
                    <button
                      key={`${section.label}-${item.id}`}
                      type="button"
                      onClick={() => handlePick(item)}
                      className="w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-slate-50 flex items-center justify-between gap-2"
                      style={{ borderColor: "#F2F4F6", color: BRAND_COLORS.bodyText }}
                    >
                      <span className={already ? "opacity-50" : undefined}>{item.name}</span>
                      {(already || ticked) && (
                        <Check
                          className="h-4 w-4 shrink-0"
                          style={{ color: BRAND_COLORS.secondaryGreen }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {onCreate && totalShown > 0 && q && (
          <Button type="button" size="sm" variant="outline" onClick={handleCreate} disabled={creating} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {creating ? "Adding…" : `Add "${search.trim()}" as a new entry`}
          </Button>
        )}
        {onCreate && createHint && !q && (
          <p className="text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>
            {createHint}
          </p>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
