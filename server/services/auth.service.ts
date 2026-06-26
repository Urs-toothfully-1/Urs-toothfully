import bcrypt from "bcryptjs"
import { userRepository } from "@/server/repositories/user.repository"
import { createSession, SessionPayload } from "@/lib/session"
import { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES } from "@/lib/constants"

export type LoginResult =
  | { success: true; token: string; user: Omit<SessionPayload, "iat" | "exp"> }
  | { success: false; error: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED" | "ACCOUNT_INACTIVE" }

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await userRepository.findByEmail(email)

    if (!user) {
      return { success: false, error: "INVALID_CREDENTIALS" }
    }

    if (!user.isActive) {
      return { success: false, error: "ACCOUNT_INACTIVE" }
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { success: false, error: "ACCOUNT_LOCKED" }
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)

    if (!passwordValid) {
      const newAttempts = user.loginAttempts + 1

      if (newAttempts >= LOGIN_MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
        await userRepository.lockAccount(user.id, lockUntil)
      } else {
        await userRepository.incrementLoginAttempts(user.id)
      }

      return { success: false, error: "INVALID_CREDENTIALS" }
    }

    await userRepository.resetLoginAttempts(user.id)

    const payload = {
      userId: user.id,
      role: user.role as SessionPayload["role"],
      branchId: user.branchId,
      name: user.name,
    }

    const token = await createSession(payload)
    return { success: true, token, user: payload }
  },
}
