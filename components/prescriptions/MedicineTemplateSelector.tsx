"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export interface MedicineTemplateItem {
  medicine: string
  frequency: string
  duration: string
}

export interface MedicineTemplate {
  id: string
  name: string
  description?: string | null
  items: MedicineTemplateItem[]
}

interface Props {
  onSelect: (template: MedicineTemplate) => void
  onClose: () => void
}

export function MedicineTemplateSelector({ onSelect, onClose }: Props) {
  const [templates, setTemplates] = useState<MedicineTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/medicine-templates")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch templates")
        return r.json()
      })
      .then((data) => {
        // An error payload is an object, not an array — never hand it to .map().
        if (!cancelled) setTemplates(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load medicine templates")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-96 flex flex-col">
        <DialogHeader>
          <DialogTitle>Medicine Templates</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No templates available
            </div>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template)}
                className="w-full p-3 border rounded hover:bg-blue-50 text-left transition-colors"
              >
                <div className="font-medium text-sm">{template.name}</div>
                {template.description && (
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.items.map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {item.medicine} ({item.frequency})
                    </Badge>
                  ))}
                </div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
