"use client"

import { useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { BRAND_COLORS } from "@/lib/constants"
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import type { LibraryResponse } from "@/app/api/clinical-library/route"

/**
 * The clinical field IS the search box.
 *
 * The doctor types where they were always going to type, and matching library
 * phrases appear beneath. There is no separate picker to aim at, and no second
 * field competing with the one holding the real text.
 *
 * For a multi-line field the search term is the line the caret is on, so a
 * second complaint can be looked up without disturbing the first. Picking
 * replaces that line rather than appending, which is what makes the field
 * usable as a search box: the half-typed "roo" becomes "Root Caries".
 */

type Entry = { id: string; name: string; group: string }

/** Prefix beats substring, so "roo" surfaces "Root Caries" before "Vertical Root Fracture". */
function rank(name: string, term: string): number {
  const n = name.toLowerCase()
  const t = term.toLowerCase()
  if (n.startsWith(t)) return 0
  if (n.includes(t)) return 1
  return -1
}

interface Props {
  /** API returning a LibraryResponse — clinical-library or medicines. */
  endpoint: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Multi-line fields search the current line; single-line ones the whole value. */
  multiline?: boolean
  rows?: number
  className?: string
  /** Offers "add <typed text>" when nothing matches. */
  onCreate?: (name: string) => Promise<void> | void
  /** Called instead of onChange when a phrase is picked in a single-line field. */
  onPick?: (name: string) => void
  disabled?: boolean
}

export function LibraryTypeahead({
  endpoint, value, onChange, placeholder, multiline, rows = 3, className, onCreate, onPick, disabled,
}: Props) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [creating, setCreating] = useState(false)
  /** Which section is open. Sections start collapsed so the first thing seen
      is a short list of headings rather than 400 phrases. */
  const [expanded, setExpanded] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  // A ref, not `loading` state: putting the flag in the dependency array makes
  // the effect re-run the instant it is set, and that run's cleanup cancels the
  // request it just started.
  const fetched = useRef(false)

  useEffect(() => {
    if (!open || fetched.current) return
    fetched.current = true
    setLoading(true)
    let cancelled = false
    fetch(endpoint)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((json: LibraryResponse) => {
        if (cancelled) return
        // An error payload is an object, not the shape we expect — never let a
        // failed request reach .map() as if it were a list.
        const flat: Entry[] = [
          ...(Array.isArray(json?.recent) ? json.recent : []).map((i) => ({ ...i, group: "Recent" })),
          ...(Array.isArray(json?.groups) ? json.groups : []).flatMap((g) =>
            g.items.map((i) => ({ ...i, group: g.group }))
          ),
        ]
        // De-duplicate: a recent phrase also lives in its specialty group.
        const seen = new Set<string>()
        setEntries(flat.filter((e) => !seen.has(e.name.toLowerCase()) && seen.add(e.name.toLowerCase())))
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load the list — you can still type freely")
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [open, endpoint])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  /** The stretch of text being searched: the caret's line, or the whole value. */
  function currentTerm(): { term: string; start: number; end: number } {
    if (!multiline) return { term: value, start: 0, end: value.length }
    const start = value.lastIndexOf("\n", Math.max(0, caret - 1)) + 1
    const nl = value.indexOf("\n", caret)
    const end = nl === -1 ? value.length : nl
    return { term: value.slice(start, end), start, end }
  }

  const { term, start, end } = currentTerm()
  const trimmed = term.trim()

  // No search term yet — clicking the field shows the whole library, so it can
  // be browsed section by section without knowing what to type.
  const matches = !entries
    ? []
    : !trimmed
      ? entries
      : entries
          .map((e) => ({ e, r: rank(e.name, trimmed) }))
          .filter((m) => m.r >= 0)
          .sort((a, b) => a.r - b.r || a.e.name.length - b.e.name.length)
          .map((m) => m.e)

  /**
   * Grouped for display, each section appearing once, ordered by its best match.
   *
   * Collapsing only consecutive runs looks right until the list is sorted by
   * relevance: the same specialty then appears several times over, each heading
   * claiming a count of 1, and the doctor sees four sections where there is
   * really one.
   */
  const byGroup = new Map<string, Entry[]>()
  for (const m of matches) {
    const list = byGroup.get(m.group)
    if (list) list.push(m)
    else byGroup.set(m.group, [m])
  }
  const grouped = [...byGroup].map(([group, items]) => ({ group, items }))

  // While searching, every matching section is open — hiding results behind a
  // second click would defeat the point of typing.
  const searching = trimmed.length > 0
  /** The items actually on screen, which is what the arrow keys move through. */
  const visible: Entry[] = searching
    ? matches
    : expanded
      ? grouped.find((g) => g.group === expanded)?.items ?? []
      : []

  const exact = entries?.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())
  const canCreate = !!onCreate && trimmed.length > 1 && !exact && matches.length === 0
  const showList = open && (loading || grouped.length > 0 || canCreate)

  function choose(name: string) {
    if (onPick) {
      onPick(name)
    } else {
      // Replace the searched stretch, so the partial word becomes the phrase.
      onChange(value.slice(0, start) + name + value.slice(end))
    }
    setOpen(false)
    setActive(0)
    fieldRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showList || visible.length === 0) return
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % visible.length) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + visible.length) % visible.length) }
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); choose(visible[active].name) }
    else if (e.key === "Escape") { setOpen(false) }
  }

  const shared = {
    ref: fieldRef as never,
    value,
    placeholder,
    disabled,
    className,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value)
      setCaret(e.target.selectionStart ?? e.target.value.length)
      setOpen(true)
      setActive(0)
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0),
    onFocus: () => setOpen(true),
    onKeyDown,
  }

  return (
    <div ref={boxRef} className="relative">
      {multiline ? <Textarea {...shared} rows={rows} /> : <Input {...shared} />}

      {showList && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white shadow-lg"
          style={{ borderColor: "#E0E3E5" }}
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {grouped.map((g) => {
            const isOpen = searching || expanded === g.group
            return (
              <div key={g.group} className="border-b last:border-b-0" style={{ borderColor: "#F2F4F6" }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setExpanded(isOpen && !searching ? null : g.group); setActive(0) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  style={{ color: BRAND_COLORS.bodyText }}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                  <span className="flex-1 truncate text-sm font-medium">{g.group}</span>
                  <span className="text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>
                    {g.items.length}
                  </span>
                </button>

                {isOpen &&
                  g.items.map((m) => {
                    const i = visible.indexOf(m)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(m.name)}
                        onMouseEnter={() => setActive(i)}
                        className="flex w-full items-center gap-3 py-2 pl-9 pr-3 text-left text-sm"
                        style={{ backgroundColor: i === active ? "#F2F7FA" : "white", color: BRAND_COLORS.bodyText }}
                      >
                        <span className="truncate">{m.name}</span>
                      </button>
                    )
                  })}
              </div>
            )
          })}

          {canCreate && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                if (!onCreate) return
                setCreating(true)
                try {
                  await onCreate(trimmed)
                  fetched.current = false
                  setEntries(null)
                  setOpen(false)
                } finally {
                  setCreating(false)
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm border-t"
              style={{ borderColor: "#F2F4F6", color: BRAND_COLORS.primaryTeal }}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add &ldquo;{trimmed}&rdquo; to the library
            </button>
          )}
        </div>
      )}
    </div>
  )
}
