/**
 * Turns a receptionist-picked receipt date (YYYY-MM-DD) into the timestamp we
 * store on both the Payment and its AccountingEntry.
 *
 * - Only a strictly PAST date is honoured; today or a future date returns
 *   undefined so the caller keeps the real `now()` default (a receipt should
 *   never be future-dated, and today deserves its true time-of-day for
 *   ordering).
 * - A past date is stored at NOON UTC (= 17:30 IST). The accounting day-book
 *   and reports bucket by day using IST-bounded ranges, and noon-UTC lands
 *   squarely inside the chosen calendar day in IST — avoiding the local-
 *   midnight off-by-one that bites @db.Date columns.
 */
function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
}

export function parseReceiptDate(raw?: string | null): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  if (raw >= todayIST()) return undefined // today or future → default now()
  return new Date(`${raw}T12:00:00Z`)
}

// demo(): node self-check for the past/today/future decision.
if (typeof module !== "undefined" && require.main === module) {
  const today = todayIST()
  const past = "2000-01-15"
  console.assert(parseReceiptDate(past)?.toISOString() === "2000-01-15T12:00:00.000Z", "past → noon UTC")
  console.assert(parseReceiptDate(today) === undefined, "today → undefined")
  console.assert(parseReceiptDate("2999-01-01") === undefined, "future → undefined")
  console.assert(parseReceiptDate("") === undefined && parseReceiptDate("bad") === undefined, "invalid → undefined")
  console.log("payment-date OK")
}
