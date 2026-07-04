/**
 * One-time script: create ANNUAL (yearly) Razorpay Plans for each paid tier.
 *
 * Annual billing = pay once per year at 20% off the monthly rate.
 * Annual amount = round(monthly * 0.8) * 12, in the currency's smallest unit.
 *
 * Run: node scripts/create-razorpay-yearly-plans.mjs
 */

import { readFileSync } from "node:fs"

const env = readFileSync(new URL("../.env", import.meta.url), "utf8")
const getEnv = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
    return m ? m[1].trim() : ""
}
const KEY_ID = getEnv("RAZORPAY_KEY_ID")
const KEY_SECRET = getEnv("RAZORPAY_KEY_SECRET")
if (!KEY_ID || !KEY_SECRET) { console.error("Missing Razorpay keys"); process.exit(1) }
const auth = "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")

// Monthly base price per currency (major currency unit). INR uses whole rupees.
const MONTHLY = {
    INR: { starter: 999, pro: 2499, agency: 5999 },
    USD: { starter: 15, pro: 35, agency: 80 },
    EUR: { starter: 15, pro: 35, agency: 80 },
    GBP: { starter: 15, pro: 35, agency: 80 },
    SGD: { starter: 15, pro: 35, agency: 80 },
    CAD: { starter: 15, pro: 35, agency: 80 },
    AUD: { starter: 15, pro: 35, agency: 80 },
    AED: { starter: 55, pro: 130, agency: 300 },
}
// Currencies without minor units (charge in whole units).
const ZERO_DECIMAL = ["INR"] // INR technically has paise; Razorpay wants paise → *100. Handle below.

const TIER_NAMES = { starter: "Starter", pro: "Pro", agency: "Agency" }

// annual per-month = 20% off monthly (rounded); annual total = that * 12
function annualTotalSmallestUnit(currency, monthly) {
    const perMonth = Number.isInteger(monthly) ? Math.round(monthly * 0.8) : Math.round(monthly * 0.8 * 100) / 100
    const annualMajor = perMonth * 12
    // All our currencies (INR, USD, EUR, GBP, SGD, CAD, AUD, AED) use 100 minor units.
    return Math.round(annualMajor * 100)
}

async function createYearlyPlan(currency, tier, monthly) {
    const amount = annualTotalSmallestUnit(currency, monthly)
    const body = {
        period: "yearly",
        interval: 1,
        item: {
            name: `Clorefy ${TIER_NAMES[tier]} ${currency} (Annual)`,
            amount,
            currency,
            description: `Clorefy ${TIER_NAMES[tier]} plan — annual, 20% off (${currency})`,
        },
        notes: { plan: tier, currency, billing_cycle: "yearly", platform: "clorefy" },
    }
    const res = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${currency}/${tier}: ${json?.error?.description || JSON.stringify(json)}`)
    return json.id
}

async function main() {
    const result = {}
    for (const [currency, tiers] of Object.entries(MONTHLY)) {
        result[currency] = {}
        for (const tier of ["starter", "pro", "agency"]) {
            try {
                const id = await createYearlyPlan(currency, tier, tiers[tier])
                result[currency][tier] = id
                console.log(`OK  ${currency} ${tier} yearly (${annualTotalSmallestUnit(currency, tiers[tier])}) -> ${id}`)
            } catch (e) {
                console.error(`FAIL ${currency} ${tier}: ${e.message}`)
                result[currency][tier] = null
            }
        }
    }
    console.log("\n=== YEARLY MAPPING ===")
    console.log(JSON.stringify(result, null, 4))
}

main().catch((e) => { console.error(e); process.exit(1) })
