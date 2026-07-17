import { APP_NAME } from "@/lib/constants"

/** The Ur's Toothfully mark. The source art sits on its own dark background,
 * so it reads as a dark tile — keep it on light and dark surfaces alike. */
export function Logo({ className = "h-9 w-9", rounded = "rounded-lg" }: { className?: string; rounded?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={APP_NAME}
      className={`${className} ${rounded} object-cover flex-shrink-0`}
    />
  )
}
