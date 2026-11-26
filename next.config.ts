import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep the headless-Chromium stack out of the server bundle — loaded from
  // node_modules at runtime (required for @sparticuz/chromium binaries).
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // File tracing misses chromium's brotli-packed binaries — include them
  // explicitly so the PDF function has them at /var/task/node_modules/...
  outputFileTracingIncludes: {
    "/api/documents/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    formats: ["image/webp"],
  },
  // Allow LAN testing from phones/tablets — only applied in local dev
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.29.158"],
  }),
  // No build-time `env` inlining: in Next 16 proxy.ts runs on the Node.js runtime and
  // reads JWT_SECRET at request time (hosts like Fly.io don't expose secrets to the build).
  // Security headers applied to every response. HSTS is already added by
  // Vercel; these cover clickjacking, MIME-sniffing, referrer leakage and
  // browser feature access for a patient-data app.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Vercel adds HSTS itself; Railway doesn't.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
