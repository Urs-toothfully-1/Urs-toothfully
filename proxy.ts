import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { SESSION_COOKIE_NAME, type Role, type SessionPayload } from "@/lib/session"
import { ROUTES } from "@/lib/constants"

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/intake", "/api/whatsapp/webhook"]

const ROLE_PATHS: Record<string, Role[]> = {
  "/admin": ["ADMIN"],
  "/reception": ["RECEPTIONIST", "ADMIN"],
  "/doctor/estimate": ["DOCTOR", "ADMIN", "RECEPTIONIST"],
  "/doctor/prescription": ["DOCTOR", "ADMIN", "RECEPTIONIST"],
  "/doctor": ["DOCTOR", "ADMIN"],
  "/whatsapp/settings": ["ADMIN"],
  "/whatsapp": ["ADMIN", "RECEPTIONIST"],
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret || secret.trim().length < 32) {
      console.error("[proxy] JWT_SECRET missing or too short")
      return null
    }

    const key = new TextEncoder().encode(secret.trim())
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] })

    const p = payload as unknown as SessionPayload
    if (!p.userId || !p.role || !p.branchId) return null

    return p
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let public paths through without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url))
  }

  const payload = await verifyToken(token)

  if (!payload) {
    // Clear the invalid/expired cookie and send to login
    const response = NextResponse.redirect(new URL(ROUTES.login, request.url))
    response.cookies.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" })
    return response
  }

  // Role-based path guard — first matching prefix wins (most specific listed first)
  for (const [path, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path)) {
      if (!allowedRoles.includes(payload.role)) {
        return NextResponse.redirect(new URL(getDefaultRoute(payload.role), request.url))
      }
      break
    }
  }

  return NextResponse.next()
}

function getDefaultRoute(role: Role): string {
  switch (role) {
    case "ADMIN": return ROUTES.admin
    case "DOCTOR": return ROUTES.doctor
    case "RECEPTIONIST": return ROUTES.reception
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/auth/login).*)",
  ],
}
