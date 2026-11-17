"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Users, MessageCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createGroupAction } from "@/actions/whatsapp-groups"

export interface GroupCard {
  id: string
  name: string
  description: string | null
  createdBy: string
  members: number
  messages: number
  lastSentAt: string | null
}

const fmt = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

/** WhatsApp → Groups: every group as a card, plus a quick "new group" form. */
export function GroupsList({ groups }: { groups: GroupCard[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pending, start] = useTransition()

  function create(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await createGroupAction({ name, description })
      if ("error" in res && res.error) return void toast.error(res.error)
      toast.success(`Group "${name}" created`)
      setName("")
      setDescription("")
      if ("id" in res) router.push(`/whatsapp/groups/${res.id}`)
    })
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 ring-1 ring-black/5"
      >
        <label className="min-w-[180px] flex-1 space-y-1">
          <span className="text-xs font-medium text-gray-700">New group</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Implant patients – Diwali offer"
            maxLength={100}
            className="h-9"
          />
        </label>
        <label className="min-w-[200px] flex-[2] space-y-1">
          <span className="text-xs font-medium text-gray-700">Description (optional)</span>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who is in it and why"
            maxLength={300}
            className="h-9"
          />
        </label>
        <Button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{" "}
          Create group
        </Button>
      </form>

      {groups.length === 0 ? (
        <div className="rounded-xl bg-white py-14 text-center ring-1 ring-black/5">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-800">No groups yet</p>
          <p className="text-sm text-gray-500">
            Create one above, add patients, then send them any approved template.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/whatsapp/groups/${g.id}`}
              className="rounded-xl bg-white p-4 ring-1 ring-black/5 transition hover:ring-emerald-300"
            >
              <p className="font-semibold text-gray-900">{g.name}</p>
              {g.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{g.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {g.members} patient{g.members === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> {g.messages} sent
                </span>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                {g.lastSentAt ? `Last sent ${fmt(g.lastSentAt)}` : "Nothing sent yet"} · by{" "}
                {g.createdBy}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
