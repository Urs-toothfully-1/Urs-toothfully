import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { APP_NAME, APP_TAGLINE } from "@/lib/constants"

// Absolute base for og:image — link previews (WhatsApp, etc.) reject relative
// URLs, and without this Next falls back to localhost or Vercel's internal
// deployment alias.
//
// We pin the canonical domain rather than reading NEXT_PUBLIC_APP_URL /
// VERCEL_PROJECT_PRODUCTION_URL: on Vercel those resolve to the internal alias
// (project-2yxjv-scale-x2.vercel.app), which then leaks into every canonical
// tag and preview image. Only an EXPLICIT NEXT_PUBLIC_SITE_URL overrides it —
// set that to the real domain once one is attached.
const CANONICAL_URL = "https://urs-toothfully-scale-x2.vercel.app"

function resolveSiteUrl(): string {
  const override = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (override) {
    try {
      return new URL(override).toString()
    } catch {
      // malformed override — fall back rather than crash at boot
    }
  }
  return CANONICAL_URL
}

const SITE_URL = resolveSiteUrl()

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
