// Self-check for event offer windows: npx tsx qa/check-offers.ts
import { liveOffer, parseTiers, tierAt, tierRule } from "../lib/offers"

const ok = (c: boolean, m: string) => {
  if (!c) throw new Error(`FAIL: ${m}`)
}
const at = (iso: string) => new Date(iso)
const min = (base: string, m: number) => new Date(at(base).getTime() + m * 60_000)

// ── Time only: Black Friday, 19:00–23:59 IST ──
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
ok(tierAt(bf, at("2026-11-27T18:28:59Z"))?.offer === "Consultation benefit", "tier 2 just before the end")
ok(tierAt(bf, at("2026-11-27T13:45:00Z"))?.nextOffer === null, "open tier announces nothing next")
ok(tierAt(bf, at("2026-11-27T18:29:00Z")) === null, "regular pricing after the end")
ok(tierAt({ ...bf, isActive: false }, at("2026-11-27T13:31:00Z")) === null, "switched off")
ok(tierAt(bf, at("2026-11-27T13:31:00Z"))?.remaining === null, "no place limit → remaining null")
ok(parseTiers([{ minutes: "x", offer: " A " }, { offer: "" }, null]).length === 1, "bad tiers dropped")

// ── Places only: first 3 patients, then a consolation offer ──
const S = "2026-12-01T04:30:00Z"
const places = {
  startsAt: at(S),
  endsAt: min(S, 600),
  isActive: true,
  tiers: parseTiers([
    { limit: 3, offer: "Free whitening" },
    { offer: "10% off" },
  ]),
}
const two = [[min(S, 1), min(S, 2)]]
ok(tierAt(places, min(S, 3), two)?.offer === "Free whitening", "2 of 3 taken → still tier 1")
ok(tierAt(places, min(S, 3), two)?.remaining === 1, "1 place left")
const three = [[min(S, 1), min(S, 2), min(S, 5)]]
ok(tierAt(places, min(S, 4), three)?.remaining === 1, "a later claim doesn't count yet")
ok(tierAt(places, min(S, 6), three)?.offer === "10% off", "3 of 3 taken → next tier")

// ── Mix: first 60 min OR first 2 patients, whichever first ──
const mix = { ...places, tiers: parseTiers([{ minutes: 60, limit: 2, offer: "Gift" }, { offer: "Later" }]) }
ok(tierAt(mix, min(S, 59), [[min(S, 10)]])?.offer === "Gift", "time left and a place left")
ok(tierAt(mix, min(S, 20), [[min(S, 10), min(S, 15)]])?.offer === "Later", "places gone before the hour")
ok(tierAt(mix, min(S, 61), [[min(S, 10)]])?.offer === "Later", "hour over with a place left")

// ── Labels and event pick ──
ok(tierRule({ minutes: 60, limit: 100 }, true) === "First 60 min or 100 patients", "mix label")
ok(tierRule({ minutes: null, limit: 1000 }, true) === "First 1000 patients", "places label")
ok(tierRule({ minutes: null, limit: null }, false) === "Then until the end", "open label")
ok(liveOffer([{ ...bf, isActive: false }, bf], at("2026-11-27T13:31:00Z"))?.event === bf, "first live event")
console.log("offers OK")
