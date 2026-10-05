import { DM_Sans, Libre_Caslon_Display } from "next/font/google"

// The clinic website's typography: Libre Caslon Display for display lines,
// DM Sans for everything else — so the invite pages feel like urstoothfully.org.
const display = Libre_Caslon_Display({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" })
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans-rw", display: "swap" })

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${sans.variable} min-h-screen bg-[#f6f1e8] text-[#342822] antialiased`} style={{ fontFamily: "var(--font-sans-rw), Arial, sans-serif" }}>
      {children}
    </div>
  )
}
