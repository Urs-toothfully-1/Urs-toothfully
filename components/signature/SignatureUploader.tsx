"use client"

import { useRef, useState, useTransition, useEffect } from "react"
import { updateDoctorSignatureAction } from "@/actions/signature"
import { BRAND_COLORS } from "@/lib/constants"
import { Upload, Trash2, Loader2, Check, PenLine, Eraser } from "lucide-react"
import { toast } from "sonner"

type Mode = "draw" | "upload"

/** Downscale an uploaded image to a max width and re-encode as PNG to keep the data URL small. */
function downscale(file: File, maxWidth = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("Canvas unsupported"))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => reject(new Error("Could not read image"))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

const CANVAS_W = 600
const CANVAS_H = 200

export function SignatureUploader({ initial }: { initial: string | null }) {
  const [mode, setMode] = useState<Mode>("draw")
  const [uploaded, setUploaded] = useState<string | null>(null) // upload-mode preview
  const [dirty, setDirty] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  // Prepare the canvas (white background so the exported PNG isn't transparent-black on print)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.strokeStyle = "#0B1B2B"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [mode])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx || !last.current) return
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!hasDrawn) setHasDrawn(true)
    if (!dirty) setDirty(true)
  }
  function up() {
    drawing.current = false
    last.current = null
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    setHasDrawn(false)
    setDirty(true)
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Please choose a PNG or JPG image.")
    try {
      setUploaded(await downscale(file))
      setDirty(true)
    } catch {
      toast.error("Could not process that image.")
    }
  }

  function save() {
    let dataUrl: string | null
    if (mode === "draw") {
      if (!hasDrawn) return toast.error("Please draw your signature first.")
      dataUrl = canvasRef.current?.toDataURL("image/png") ?? null
    } else {
      dataUrl = uploaded
    }
    start(async () => {
      const res = await updateDoctorSignatureAction(dataUrl)
      if (res.success) {
        toast.success("Signature saved")
        setDirty(false)
      } else {
        toast.error(res.error ?? "Failed to save")
      }
    })
  }

  function removeSaved() {
    start(async () => {
      const res = await updateDoctorSignatureAction(null)
      if (res.success) {
        toast.success("Signature removed")
        setDirty(false)
      } else {
        toast.error(res.error ?? "Failed to remove")
      }
    })
  }

  const tabBtn = (m: Mode, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); setDirty(false) }}
      className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-colors"
      style={mode === m
        ? { backgroundColor: BRAND_COLORS.primaryTeal, color: "#fff" }
        : { color: BRAND_COLORS.secondaryText }}
    >
      {icon}{label}
    </button>
  )

  return (
    <div className="space-y-4">
      {initial && (
        <div className="rounded-xl border border-[#E0E3E5] bg-white p-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={initial} alt="Current signature" style={{ maxHeight: 48, maxWidth: 200, objectFit: "contain" }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Current signature</p>
            <button type="button" onClick={removeSaved} disabled={saving}
              className="text-xs font-medium text-red-600 inline-flex items-center gap-1 mt-0.5">
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
        {tabBtn("draw", <PenLine className="h-4 w-4" />, "Draw here")}
        {tabBtn("upload", <Upload className="h-4 w-4" />, "Upload image")}
      </div>

      {mode === "draw" ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-[#E0E3E5] overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
              className="w-full block cursor-crosshair"
              style={{ touchAction: "none", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Sign with your finger or stylus on a tablet.
            </p>
            <button type="button" onClick={clearCanvas}
              className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: BRAND_COLORS.secondaryText }}>
              <Eraser className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border-2 border-dashed flex items-center justify-center bg-white"
            style={{ borderColor: BRAND_COLORS.lightBackground, minHeight: 160 }}>
            {uploaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploaded} alt="Signature preview" style={{ maxHeight: 140, maxWidth: "100%", objectFit: "contain" }} />
            ) : (
              <p className="text-sm py-10" style={{ color: BRAND_COLORS.borderDivider }}>No image chosen yet</p>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onPick} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}>
            <Upload className="h-4 w-4" />{uploaded ? "Choose a different image" : "Choose image"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save signature
      </button>

      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
        Your signature appears on prescriptions and documents for the patients you see. You can replace it anytime.
      </p>
    </div>
  )
}
