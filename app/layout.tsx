import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { APP_NAME, APP_TAGLINE } from "@/lib/constants"

// Absolute base for og:image — link previews (WhatsApp, etc.) reject relative
// URLs, and without this Next falls back to localhost.
//
// Set NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_APP_URL) when a custom domain is
// attached. Both are currently defined-but-empty in Vercel, so blank values are
// filtered out — `new URL("")` throws and would take the whole site down.
// Vercel's VERCEL_PROJECT_PRODUCTION_URL is deliberately ignored: it resolves
// to an internal alias (project-2yxjv.vercel.app), not the canonical domain.
const CANONICAL_URL = "https://urs-toothfully-scale-x2.vercel.app"

function firstUrl(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const v = c?.trim()
    if (!v) continue
    try {
      return new URL(v).toString()
    } catch {
      // ignore a malformed env value rather than crash the app
    }
  }
  return CANONICAL_URL
}

const SITE_URL = firstUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL)

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_TAGLINE,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: APP_TAGLINE },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} h-full`}>
      <body className="min-h-full bg-background font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
