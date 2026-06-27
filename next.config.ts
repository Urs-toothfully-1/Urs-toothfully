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
  // Allow testing from other devices on the local network (phones, tablets)
  allowedDevOrigins: ["192.168.29.158"],
  // Explicitly expose to Edge Runtime (proxy.ts)
  env: {
    JWT_SECRET: process.env.JWT_SECRET,
  },
}

export default nextConfig
