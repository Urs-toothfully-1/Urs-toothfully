"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Props {
  onSelect: (toothNumbers: string[]) => void
  onClose: () => void
  selected?: string[]
}

const TOOTH_MAP = {
  adults: [
    { quad: "UR", teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
    { quad: "UL", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
    { quad: "LR", teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
    { quad: "LL", teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
  ],
}

export function ToothSelectorDialog({ onSelect, onClose, selected = [] }: Props) {
  const [selectedTeeth, setSelectedTeeth] = useState<Set<number>>(
    new Set(selected.map(Number))
  )

  const handleToothClick = (tooth: number) => {
    const newSelected = new Set(selectedTeeth)
    if (newSelected.has(tooth)) {
      newSelected.delete(tooth)
    } else {
      newSelected.add(tooth)
    }
    setSelectedTeeth(newSelected)
  }

  const handleSelectQuad = (teeth: number[]) => {
    const newSelected = new Set(selectedTeeth)
    const allSelected = teeth.every((t) => newSelected.has(t))

    teeth.forEach((t) => {
      if (allSelected) {
        newSelected.delete(t)
      } else {
        newSelected.add(t)
      }
    })
    setSelectedTeeth(newSelected)
  }

  const handleSelectAll = () => {
    const allTeeth = TOOTH_MAP.adults.flatMap((q) => q.teeth)
    const newSelected = new Set(selectedTeeth)

    if (selectedTeeth.size === allTeeth.length) {
      newSelected.clear()
    } else {
      allTeeth.forEach((t) => newSelected.add(t))
    }
    setSelectedTeeth(newSelected)
  }

  const handleDone = () => {
    const toothArray = Array.from(selectedTeeth)
      .sort((a, b) => a - b)
      .map(String)
    onSelect(toothArray)
    onClose()
  }

  const allTeeth = TOOTH_MAP.adults.flatMap((q) => q.teeth)
  const isAllSelected = selectedTeeth.size === allTeeth.length

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Teeth</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection Summary */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedTeeth.size} tooth/teeth selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {/* Selected Teeth Badge Display */}
          {selectedTeeth.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedTeeth)
                .sort((a, b) => a - b)
                .map((tooth) => (
                  <Badge key={tooth} variant="secondary" className="cursor-pointer text-xs">
                    {tooth}
                    <button
                      type="button"
                      onClick={() => handleToothClick(tooth)}
                      className="ml-1 hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
            </div>
          )}

          {/* Tooth Grid */}
          <div className="space-y-3 border-t pt-4">
            {TOOTH_MAP.adults.map((quad) => (
              <div key={quad.quad} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {quad.quad === "UR"
                      ? "Upper Right"
                      : quad.quad === "UL"
                        ? "Upper Left"
                        : quad.quad === "LR"
                          ? "Lower Right"
                          : "Lower Left"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectQuad(quad.teeth)}
                    className="text-xs h-6"
                  >
                    {quad.teeth.every((t) => selectedTeeth.has(t)) ? "Deselect" : "Select"} Quad
                  </Button>
                </div>

                <div className="grid grid-cols-8 gap-2">
                  {quad.teeth.map((tooth) => (
                    <button
                      key={tooth}
                      type="button"
                      onClick={() => handleToothClick(tooth)}
                      className={`p-2 text-xs font-semibold rounded border-2 transition-colors ${
                        selectedTeeth.has(tooth)
                          ? "bg-blue-500 border-blue-600 text-white"
                          : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                      }`}
                    >
                      {tooth}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Visual FDI Reference */}
          <div className="text-xs text-muted-foreground bg-slate-50 p-2 rounded">
            FDI notation: first digit = quadrant (1 = upper right, 2 = upper left, 3 = lower left,
            4 = lower right), second digit = position from the midline (1 = central incisor …
            8 = third molar). E.g. 16 = upper right first molar.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {/* No teeth is a valid answer — generalised findings (e.g. generalised
              gingivitis) have no single tooth, and clearing a wrong pick must be
              possible. */}
          <Button type="button" onClick={handleDone}>
            {selectedTeeth.size === 0 ? "Done (no specific tooth)" : `Done (${selectedTeeth.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
