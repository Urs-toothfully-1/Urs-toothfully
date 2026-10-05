import Link from "next/link"
import { APP_NAME, EMERGENCY_CONTACT } from "@/lib/constants"

/**
 * Building blocks in the urstoothfully.org editorial language: ivory & espresso,
 * a gold accent, Libre Caslon Display for emphasis, sharp corners, fine rules.
 */

export const C = { cream: "#f6f1e8", cream2: "#e9dfd1", ink: "#342822", ink2: "#493a31", gold: "#b79a73", muted: "#766b61" }

export const serif = { fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400 } as const

export function Eyebrow({ children, dot = false, className = "", light = false }: { children: React.ReactNode; dot?: boolean; className?: string; light?: boolean }) {
  return (
    <span className={`block text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.16em] ${className}`} style={{ color: light ? C.cream : C.muted }}>
      {dot && <i className="inline-block h-1.5 w-1.5 rounded-full mr-2.5 align-middle" style={{ backgroundColor: C.gold }} />}
      {children}
    </span>
  )
}

/** The site's signature button: a label and a gold square that turns on hover. */
export function ArrowButton({ href, children, tone = "cream", type, external }: {
  href?: string; children: React.ReactNode; tone?: "cream" | "ink"; type?: "submit"; external?: boolean
}) {
  const cls = "group inline-flex items-center justify-between gap-7 pl-6 pr-[7px] py-[7px] text-[15px] font-semibold transition-colors"
  const style = tone === "cream" ? { backgroundColor: C.cream, color: C.ink } : { backgroundColor: C.ink, color: C.cream }
  const inner = (
    <>
      <span>{children}</span>
      <span className="grid h-[42px] w-[42px] place-items-center text-[22px] transition-transform duration-300 group-hover:rotate-45" style={{ backgroundColor: C.gold, color: C.ink }} aria-hidden>
        ↗
      </span>
    </>
  )
  if (type) return <button type={type} className={cls} style={style}>{inner}</button>
  return external
    ? <a href={href} className={cls} style={style} target="_blank" rel="noopener">{inner}</a>
    : <Link href={href ?? "/"} className={cls} style={style}>{inner}</Link>
}

export function SiteBar({ light = true }: { light?: boolean }) {
  const fg = light ? C.cream : C.ink
  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-[6vw] py-5 border-b" style={{ borderColor: light ? "rgba(246,241,232,.18)" : "rgba(52,40,34,.15)", color: fg }}>
      <a href="https://urstoothfully.org" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rewards/mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="text-[22px] sm:text-[24px] tracking-[-0.02em]" style={serif}>
          Ur&rsquo;s <em className="italic">Toothfully</em>
        </span>
      </a>
      <a href={`tel:${EMERGENCY_CONTACT}`} className="hidden sm:inline text-[13px] tracking-[0.08em]" style={{ color: fg, opacity: 0.8 }}>
        CALL {EMERGENCY_CONTACT}
      </a>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="px-[6vw] py-10 text-[13px]" style={{ backgroundColor: C.ink, color: C.cream }}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-8" style={{ borderColor: "rgba(246,241,232,.15)" }}>
        <span className="text-[20px]" style={serif}>Ur&rsquo;s <em className="italic">Toothfully</em></span>
        <span className="flex flex-wrap gap-x-6 gap-y-2 tracking-[0.08em] text-[12px]" style={{ color: "rgba(246,241,232,.7)" }}>
          <span>PARK STREET</span><span style={{ color: C.gold }}>✦</span><span>SALT LAKE</span><span style={{ color: C.gold }}>✦</span><span>NEW ALIPORE</span>
        </span>
        <span style={{ color: "rgba(246,241,232,.6)" }}>© {new Date().getFullYear()} {APP_NAME}</span>
      </div>
    </footer>
  )
}

/** Thin gold motif (the site's fine-line brand art) for dark panels. */
export function LineArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`pointer-events-none ${className}`} fill="none" stroke={C.gold} strokeWidth="1" aria-hidden>
      <circle cx="200" cy="200" r="190" opacity=".5" />
      <circle cx="200" cy="200" r="150" opacity=".35" />
      <circle cx="200" cy="200" r="110" opacity=".25" />
      <path d="M120 170c30-40 130-40 160 0M140 230c20 40 100 40 120 0" opacity=".45" />
    </svg>
  )
}
