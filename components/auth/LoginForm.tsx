"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { loginAction, LoginState } from "@/actions/auth"
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ArrowRight } from "lucide-react"

const GOOGLE_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
      style={{
        background: pending
          ? "#707882"
          : "linear-gradient(135deg, #005E97, #0077BE)",
        boxShadow: pending ? "none" : "0 4px 14px rgba(14,165,233,0.35)",
      }}
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
      ) : (
        <><span>Sign In</span><ArrowRight className="h-4 w-4" /></>
      )}
    </button>
  )
}

const initialState: LoginState = {}

const inputCls = "w-full h-11 rounded-xl border text-sm pl-10 pr-4 transition-all outline-none focus:ring-2 focus:ring-[#0077BE]/30 focus:border-[#0077BE]"
const inputStyle = { backgroundColor: "#F7F9FB", borderColor: "#E0E3E5", color: "#191C1E" }

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div
          className="flex items-start gap-2.5 p-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium" style={{ color: "#374151" }}>
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#707882" }} />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.fields?.email}
            placeholder="you@toothfully.in"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium" style={{ color: "#374151" }}>
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#707882" }} />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={`${inputCls} pr-10`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword
              ? <EyeOff className="h-4 w-4" style={{ color: "#707882" }} />
              : <Eye className="h-4 w-4" style={{ color: "#707882" }} />
            }
          </button>
        </div>
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>

    {GOOGLE_ENABLED && (
      <div className="mt-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ backgroundColor: "#E0E3E5" }} />
          <span className="text-xs" style={{ color: "#707882" }}>or</span>
          <div className="h-px flex-1" style={{ backgroundColor: "#E0E3E5" }} />
        </div>
        <GoogleSignInButton />
      </div>
    )}
    </>
  )
}
