import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME, type Role } from "@/lib/session"
import { ROUTES } from "@/lib/constants"

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/intake"]

const ROLE_PATHS: Record<string, Role[]> = {
  "/admin": ["ADMIN"],
  "/reception": ["RECEPTIONIST", "ADMIN"],
  "/doctor": ["DOCTOR", "ADMIN"],
}

// ─────────────────────────────────────────────────────────────────────────────
// Native Web Crypto JWT verifier — no external library
//
// Why: jose (used in lib/session.ts for server-side code) can fail silently in
// the Next.js Edge Runtime on mobile/tablet browsers. The native crypto.subtle
// API is part of the Edge Runtime standard and works reliably on ALL platforms.
// ─────────────────────────────────────────────────────────────────────────────
function b64urlDecode(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

interface JWTPayload {
  userId: string
  role: Role
  branchId: string
  name: string
  exp?: number
  iat?: number
}

async function verifySessionEdge(token: string): Promise<JWTPayload | null> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret || secret.length < 32) return null

    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts

    // Import the HMAC-SHA256 key using native Web Crypto
    const keyMaterial = new TextEncoder().encode(secret)
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )

    // Verify the signature
    const signatureBytes = b64urlDecode(signatureB64)
    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

    // Cast needed: TypeScript types are overly strict here;
    // crypto.subtle.verify accepts Uint8Array at runtime
    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes as unknown as ArrayBuffer,
      signedData as unknown as ArrayBuffer
    )

    if (!isValid) return null

    // Decode payload
    const payloadBytes = b64urlDecode(payloadB64)
    const payloadText = new TextDecoder().decode(payloadBytes)
    const payload: JWTPayload = JSON.parse(payloadText)

    // Check token expiry
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null

    // Validate required fields
    if (!payload.userId || !payload.role || !payload.branchId) return null

    return payload
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url))
  }

  const payload = await verifySessionEdge(token)

  if (!payload) {
    // Token invalid or expired — clear cookie and redirect to login
    const response = NextResponse.redirect(new URL(ROUTES.login, request.url))
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      maxAge: 0,
      path: "/",
    })
    return response
  }

  // Role-based path protection
  for (const [path, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path) && !allowedRoles.includes(payload.role)) {
      return NextResponse.redirect(new URL(getDefaultRoute(payload.role), request.url))
    }
  }

  return NextResponse.next()
}

function getDefaultRoute(role: Role): string {
  switch (role) {
    case "ADMIN":
      return ROUTES.admin
    case "DOCTOR":
      return ROUTES.doctor
    case "RECEPTIONIST":
      return ROUTES.reception
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/auth/login).*)",
  ],
}
