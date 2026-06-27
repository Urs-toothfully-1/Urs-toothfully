import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    formats: ["image/webp"],
  },
  // Explicitly expose to Edge Runtime (proxy.ts) — process.env is not
  // reliably populated in Edge Runtime without this declaration.
  env: {
    JWT_SECRET: process.env.JWT_SECRET,
  },
}

export default nextConfig
