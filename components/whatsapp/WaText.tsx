import { Fragment } from "react"

/** Renders WhatsApp's *bold* markup (line breaks come from the parent's whitespace-pre). */
export function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={i}>{part.slice(1, -1)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}
