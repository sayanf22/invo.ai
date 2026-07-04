/**
 * v2 pricing: purchasing-power-corrected ladder anchored at $15 / $35 / $100 (USD-equiv).
 *
 * Rule:
 *  - Currencies STRONGER than USD (EUR, GBP, CHF) keep the same numeral as USD —
 *    their strength alone pushes the INR-equivalent above the USD anchor, which is
 *    appropriate (Germany/UK/Switzerland GDP per capita >= US).
 *  - Currencies WEAKER than USD (AUD, CAD, SGD, NZD, HKD, AED) have the numeral
 *    scaled up by (USD_rate / currency_rate) so the INR-equivalent never falls
 *    below the USD anchor. This fixes the earlier AUD/CAD inversion.
 *
 * Adds 4 new billable countries with good card/subscription penetration:
 * Switzerland (CHF), New Zealand (NZD), Hong Kong (HKD), Sweden (SEK, upgraded
 * from its old non-billable low pricing).
 *
 * Creates BOTH monthly and yearly (20% off * 12) plans for every currency below.
 * INR is untouched — existing INR plans are reused.
 */

import { readFileSync } from "node:fs"

const env = readFileSync(new URL("../.env", import.meta.url), "utf8")
const getEnv = (k) => { const m = env.match(new RegExp(`^${k}=(.*)$`, "m")); return m ? m[1].trim() : "" }
const auth = "Basic " + Buffer.from(`${getEnv("RAZORPAY_KEY_ID")}:${getEnv("RAZORPAY_KEY_SECRET")}`).toString("base64")

// Monthly numerals (major currency unit) per currency, per tier.
// Verified against today's mid-market rates so every currency clears the
// $15/$35/$100 USD-equivalent anchor (INR: ~1428 / ~3333 / ~9523) with a small
// safety margin (2-15%) — never below, never wildly over.
const MONTHLY = {
    USD: { starter: 15, pro: 35, agency: 100 },
    EUR: { starter: 15, pro: 35, agency: 100 },
    GBP: { starter: 15, pro: 35, agency: 100 },
    CHF: { starter: 15, pro: 35, agency: 100 },
    AUD: { starter: 24, pro: 55, agency: 155 },
    CAD: { starter: 24, pro: 54, agency: 152 },
    SGD: { starter: 22, pro: 49, agency: 140 },
    NZD: { starter: 28, pro: 64, agency: 180 },
    HKD: { starter: 130, pro: 300, agency: 850 },
    SEK: { starter: 145, pro: 335, agency: 950 },
    AED: { starter: 58, pro: 135, agency: 375 },
}

const TIER_NAMES = { starter: "Starter", pro: "Pro", agency: "Agency" }

function yearlyPerMonth(monthly) {
    return Math.round(monthly * 0.8)
}

async function createPlan(period, currency, tier, amountMajor) {
    const amount = Math.round(amountMajor * 100) // all these currencies use 100 minor units
    const body = {
        period,
        interval: 1,
        item: {
            name: `Clorefy ${TIER_NAMES[tier]} ${currency} (${period === "yearly" ? "Annual" : "Monthly"}) v2`,
            amount,
            currency,
            description: `Clorefy ${TIER_NAMES[tier]} — ${period} v2 pricing (${currency})`,
        },
        notes: { plan: tier, currency, billing_cycle: period === "yearly" ? "yearly" : "monthly", platform: "clorefy", pricing_version: "v2" },
    }
    const res = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${period}/${currency}/${tier}: ${json?.error?.description || JSON.stringify(json)}`)
    return json.id
}

async function main() {
    const result = {}
    for (const [currency, tiers] of Object.entries(MONTHLY)) {
        result[currency] = {}
        for (const tier of ["starter", "pro", "agency"]) {
            const monthlyAmt = tiers[tier]
            const yearlyPerMo = yearlyPerMonth(monthlyAmt)
            const yearlyTotal = yearlyPerMo * 12
            try {
                const monthlyId = await createPlan("monthly", currency, tier, monthlyAmt)
                const yearlyId = await createPlan("yearly", currency, tier, yearlyTotal)
                result[currency][tier] = { monthly: monthlyId, yearly: yearlyId }
                console.log(`OK  ${currency} ${tier}: monthly=${monthlyAmt} -> ${monthlyId} | yearly=${yearlyTotal} -> ${yearlyId}`)
            } catch (e) {
                console.error(`FAIL ${currency} ${tier}: ${e.message}`)
                result[currency][tier] = { monthly: null, yearly: null }
            }
        }
    }
    console.log("\n=== V2 MAPPING (paste into lib/razorpay.ts) ===")
    console.log(JSON.stringify(result, null, 4))
}

main().catch((e) => { console.error(e); process.exit(1) })
