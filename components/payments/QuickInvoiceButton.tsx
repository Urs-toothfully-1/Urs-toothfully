"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import { ProductInvoiceDialog } from "./ProductInvoiceDialog"

interface Props {
  patientId: string
  branchId: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
}

export function QuickInvoiceButton({ patientId, branchId, variant = "outline", size = "default" }: Props) {
  const [showDialog, setShowDialog] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-2"
      >
        <ShoppingCart className="h-4 w-4" />
        Bill Products
      </Button>

      {showDialog && (
        <ProductInvoiceDialog
          patientId={patientId}
          branchId={branchId}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  )
}
