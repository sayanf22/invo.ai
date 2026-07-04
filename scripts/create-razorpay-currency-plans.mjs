/**
 * One-time script: create per-currency monthly Razorpay Plans for each paid tier.
 *
 * Razorpay recurring subscriptions charge in the currency of their Plan object.
 * To let international users pay in their own currency, we need one Plan per
 * (currency × tier). This script creates them and prints a ready-to-paste
 * mapping for lib/razorpay.ts.
 *
 * Amounts mirror lib/pricing.ts (monthly), in the currency's smallest unit.
 * Run:  node scripts/create-razorpay-currency-plans.mjs
 */

import { readFileSync } from "node:fs"

// ── Load keys from .env (never hardcode) ─────────────────────────────────
const env = readFileSync(new URL("../.env", import.meta.url), "utf8")
const getEnv = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
    return m ? m[1].trim() : ""
}
const KEY_ID = getEnv("RAZORPAY_KEY_ID")
const KEY_SECRET = getEnv("RAZORPAY_KEY_SECRET")
if (!KEY_ID || !KEY_SECRET) {
    console.error("Missing Razorpay keys in .env")
    process.exit(1)
}
const auth = "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")

// ── Monthly prices per currency (smallest unit) — mirrors lib/pricing.ts ──
// All of these currencies use 2 decimal places, so smallest unit = price * 100.
const CURRENCY_PRICES = {
    USD: { starter: 15, pro: 35, agency: 80 },
    EUR: { starter: 15, pro: 35, agency: 80 },
    GBP: { starter: 15, pro: 35, agency: 80 },
    SGD: { starter: 15, pro: 35, agency: 80 },
    CAD: { starter: 15, pro: 35, agency: 80 },
    AUD: { starter: 15, pro: 35, agency: 80 },
    AED: { starter: 55, pro: 130, agency: 300 },
}

const TIER_NAMES = { starter: "Starter", pro: "Pro", agency: "Agency" }

async function createPlan(currency, tier, price) {
    const amount = Math.round(price * 100)
    const body = {
        period: "monthly",
        interval: 1,
        item: {
            name: `Clorefy ${TIER_NAMES[tier]} ${currency}`,
            amount,
            currency,
            description: `Clorefy ${TIER_NAMES[tier]} plan — monthly (${currency})`,
        },
        notes: { plan: tier, currency, platform: "clorefy" },
    }
    const res = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) {
        throw new Error(`${currency}/${tier}: ${json?.error?.description || JSON.stringify(json)}`)
    }
    return json.id
}

async function main() {
    const result = {}
    for (const [currency, tiers] of Object.entries(CURRENCY_PRICES)) {
        result[currency] = {}
        for (const tier of ["starter", "pro", "agency"]) {
            try {
                const id = await createPlan(currency, tier, tiers[tier])
                result[currency][tier] = id
                console.log(`OK  ${currency} ${tier} -> ${id}`)
            } catch (e) {
                console.error(`FAIL ${currency} ${tier}: ${e.message}`)
                result[currency][tier] = null
            }
        }
    }
    console.log("\n=== MAPPING (paste into lib/razorpay.ts) ===")
    console.log(JSON.stringify(result, null, 4))
}

main().catch((e) => { console.error(e); process.exit(1) })
