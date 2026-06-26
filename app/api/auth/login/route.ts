import { NextRequest, NextResponse } from "next/server"
import { authService } from "@/server/services/auth.service"
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/session"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const result = await authService.login(String(email).trim(), String(password))

    if (!result.success) {
      const statusMap = {
        INVALID_CREDENTIALS: 401,
        ACCOUNT_LOCKED: 423,
        ACCOUNT_INACTIVE: 403,
      } as const
      return NextResponse.json({ error: result.error }, { status: statusMap[result.error] })
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
