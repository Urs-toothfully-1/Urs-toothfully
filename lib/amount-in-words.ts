/** "Rupees Thirty-Four Thousand Four Hundred Only" — Indian numbering (lakh, crore). */

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function below100(n: number): string {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "")
}
function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : "", r ? below100(r) : ""].filter(Boolean).join(" ")
}

function wholeToWords(n: number): string {
  if (n === 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(n / 1_00_00_000)
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((n % 1_00_000) / 1000)
  const rest = n % 1000
  if (crore) parts.push(`${wholeToWords(crore)} Crore`)
  if (lakh) parts.push(`${below100(lakh)} Lakh`)
  if (thousand) parts.push(`${below100(thousand)} Thousand`)
  if (rest) parts.push(below1000(rest))
  return parts.join(" ")
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.max(0, amount))
  const paise = Math.round((Math.max(0, amount) - rupees) * 100)
  return `Rupees ${wholeToWords(rupees)}${paise ? ` and ${below100(paise)} Paise` : ""} Only`
}

// demo(): runnable self-check (npx tsx lib/amount-in-words.ts).
if (typeof module !== "undefined" && require.main === module) {
  const ok = (got: string, want: string) => { if (got !== want) throw new Error(`FAIL: "${got}" != "${want}"`) }
  ok(amountInWords(34400), "Rupees Thirty-Four Thousand Four Hundred Only")
  ok(amountInWords(150000), "Rupees One Lakh Fifty Thousand Only")
  ok(amountInWords(12500000), "Rupees One Crore Twenty-Five Lakh Only")
  ok(amountInWords(0), "Rupees Zero Only")
  ok(amountInWords(1001.5), "Rupees One Thousand One and Fifty Paise Only")
  console.log("amount-in-words OK")
}
