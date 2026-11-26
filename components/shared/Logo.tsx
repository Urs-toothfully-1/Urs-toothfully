import { APP_NAME } from "@/lib/constants"

/**
 * The Ur's Toothfully mark.
 * - default: the dark-tile art (staff app).
 * - gold: the gold emblem on a cream tile — patient-facing pages.
 */
export function Logo({
  className = "h-9 w-9",
  rounded = "rounded-lg",
  variant = "default",
}: {
  className?: string
  rounded?: string
  variant?: "default" | "gold"
}) {
  if (variant === "gold")
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo-gold.png"
        alt={APP_NAME}
        className={`${className} ${rounded} object-contain flex-shrink-0 bg-[#FBF7EF] p-1`}
      />
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={APP_NAME}
      className={`${className} ${rounded} object-cover flex-shrink-0`}
    />
  )
}
