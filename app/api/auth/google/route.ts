import { NextRequest, NextResponse } from "next/server"
import { verifyGoogleIdToken } from "@/lib/google-auth"
import { authService } from "@/server/services/auth.service"
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/session"

export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json()
    if (!credential) {
      return NextResponse.json({ error: "Missing Google credential" }, { status: 400 })
    }

    const identity = await verifyGoogleIdToken(String(credential))
    if (!identity) {
      return NextResponse.json({ error: "Could not verify your Google sign-in. Please try again." }, { status: 401 })
    }
    if (!identity.emailVerified) {
      return NextResponse.json({ error: "Your Google email is not verified." }, { status: 403 })
    }

    const result = await authService.loginWithGoogle(identity.email)
    if (!result.success) {
      const map = {
        ACCOUNT_INACTIVE: { status: 403, msg: "This account is inactive. Please contact your administrator." },
        ACCOUNT_LOCKED: { status: 423, msg: "This account is temporarily locked. Try again later." },
        INVALID_CREDENTIALS: {
          status: 401,
          msg: "No staff account is registered for this Google email. Ask your administrator to add you.",
        },
      } as const
      const { status, msg } = map[result.error]
      return NextResponse.json({ error: msg }, { status })
    }

    const response = NextResponse.json({
      user: {
        userId: result.user.userId,
        name: result.user.name,
        role: result.user.role,
        branchId: result.user.branchId,
      },
    })
    response.cookies.set(SESSION_COOKIE_NAME, result.token, SESSION_COOKIE_OPTIONS)
    return response
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
