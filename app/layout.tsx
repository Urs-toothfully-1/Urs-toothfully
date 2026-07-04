import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { APP_NAME, APP_TAGLINE } from "@/lib/constants"

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  robots: { index: false, follow: false },
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
