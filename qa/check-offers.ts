// Self-check for event offer windows: npx tsx qa/check-offers.ts
import { liveOffer, parseTiers, tierAt } from "../lib/offers"

const ok = (c: boolean, m: string) => {
  if (!c) throw new Error(`FAIL: ${m}`)
}
const at = (iso: string) => new Date(iso)
// Black Friday: starts 19:00 IST (13:30Z), ends 23:59 IST (18:29Z)
const bf = {
  startsAt: at("2026-11-27T13:30:00Z"),
  endsAt: at("2026-11-27T18:29:00Z"),
  isActive: true,
  tiers: parseTiers([
    { minutes: 10, offer: "FREE teeth cleaning" },
    { minutes: null, offer: "Consultation benefit" },
    { minutes: 5, offer: "never reached" },
  ]),
}

ok(tierAt(bf, at("2026-11-27T13:29:59Z")) === null, "nothing before the start")
ok(tierAt(bf, at("2026-11-27T13:30:00Z"))?.offer === "FREE teeth cleaning", "tier 1 at the start")
ok(tierAt(bf, at("2026-11-27T13:39:59Z"))?.offer === "FREE teeth cleaning", "tier 1 at 9:59")
ok(tierAt(bf, at("2026-11-27T13:39:59Z"))?.nextOffer === "Consultation benefit", "next offer named")
ok(tierAt(bf, at("2026-11-27T13:40:00Z"))?.offer === "Consultation benefit", "tier 2 at exactly 10 min")
ok(tierAt(bf, at("2026-11-27T13:40:00Z"))?.endsAt.getTime() === bf.endsAt.getTime(), "open tier runs to the end")
ok(tierAt(bf, at("2026-11-27T18:28:59Z"))?.offer === "Consultation benefit", "tier 2 just before the end")
ok(tierAt(bf, at("2026-11-27T18:29:00Z")) === null, "regular pricing after the end")
ok(tierAt({ ...bf, isActive: false }, at("2026-11-27T13:31:00Z")) === null, "switched off")
ok(parseTiers([{ minutes: "x", offer: " A " }, { offer: "" }, null]).length === 1, "bad tiers dropped")
ok(liveOffer([{ ...bf, isActive: false }, bf], at("2026-11-27T13:31:00Z"))?.event === bf, "first live event")
console.log("offers OK")
