"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { authService } from "@/server/services/auth.service"
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/session"
import { ROUTES } from "@/lib/constants"

export type LoginState = {
  error?: string
  fields?: { email?: string }
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email")?.toString().trim() ?? ""
  const password = formData.get("password")?.toString() ?? ""

  if (!email || !password) {
    return { error: "Email and password are required.", fields: { email } }
  }

  const result = await authService.login(email, password)

  if (!result.success) {
    const messages: Record<typeof result.error, string> = {
      INVALID_CREDENTIALS: "Invalid email or password.",
      ACCOUNT_LOCKED:
        "Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.",
      ACCOUNT_INACTIVE: "This account has been deactivated. Contact your administrator.",
    }
    return { error: messages[result.error], fields: { email } }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, result.token, SESSION_COOKIE_OPTIONS)

  const destination =
    result.user.role === "ADMIN"
      ? ROUTES.admin
      : result.user.role === "DOCTOR"
        ? ROUTES.doctor
        : ROUTES.reception

  redirect(destination)
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect(ROUTES.login)
}
