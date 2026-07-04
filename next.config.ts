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
  // Allow LAN testing from phones/tablets — only applied in local dev
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.29.158"],
  }),
  // Edge Runtime (proxy.ts / middleware) cannot read process.env at runtime in
  // the same way Node.js can. Declaring vars here inlines them at build time so
  // the Edge bundle always has the correct value.
  env: {
    JWT_SECRET: process.env.JWT_SECRET ?? "",
  },
}

export default nextConfig
