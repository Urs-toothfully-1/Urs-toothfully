"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { loginAction, LoginState } from "@/actions/auth"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { BRAND_COLORS } from "@/lib/constants"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-11 text-sm font-semibold text-white"
      style={{
        backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal,
        borderColor: "transparent",
      }}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in…
        </>
      ) : (
        "Sign In"
      )}
    </Button>
  )
}

const initialState: LoginState = {}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <Alert
          variant="destructive"
          className="border-red-200 bg-red-50 text-red-800"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-sm font-medium"
          style={{ color: BRAND_COLORS.bodyText }}
        >
          Email Address
        </Label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: BRAND_COLORS.borderDivider }}
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.fields?.email}
            placeholder="you@toothfully.in"
            className="pl-10 h-11 border-[#CCCCCC] focus-visible:ring-[#4ABCC8] text-sm"
            style={{ backgroundColor: BRAND_COLORS.lightBackground }}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="text-sm font-medium"
          style={{ color: BRAND_COLORS.bodyText }}
        >
          Password
        </Label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: BRAND_COLORS.borderDivider }}
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="pl-10 pr-10 h-11 border-[#CCCCCC] focus-visible:ring-[#4ABCC8] text-sm"
            style={{ backgroundColor: BRAND_COLORS.lightBackground }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
            ) : (
              <Eye className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
            )}
          </button>
        </div>
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
