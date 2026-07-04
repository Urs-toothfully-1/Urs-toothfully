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
}

export default nextConfig
