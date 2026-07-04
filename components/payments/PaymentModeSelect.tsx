import { BRAND_COLORS } from "@/lib/constants"

const MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
]

interface Props {
  defaultValue?: string
  required?: boolean
}

export function PaymentModeSelect({ defaultValue = "CASH", required }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
        Payment Mode {required && <span className="text-red-500">*</span>}
      </p>
      <div className="flex flex-wrap gap-3">
        {MODES.map((m) => (
          <label key={m.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value={m.value}
              defaultChecked={m.value === defaultValue}
              required={required}
              className="accent-[#0077BE]"
            />
            <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
              {m.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
