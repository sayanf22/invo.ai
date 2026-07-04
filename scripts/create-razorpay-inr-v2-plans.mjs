/**
 * Lower India (INR) pricing: Starter ₹649, Pro ₹1799, Agency ₹4999 (monthly).
 * Annual = exactly 20% off monthly, charged once/year (monthly*0.8*12), rounded
 * to whole rupees for a clean number.
 *
 * Existing INR plans (₹999/₹2499/₹5999) are NOT modified — Razorpay plans are
 * immutable and cannot be deleted. New plans are created and the app is
 * repointed at them. Existing active subscribers on the old INR plans keep
 * their current price (Razorpay does not retroactively change price on
 * existing subscriptions when you swap which plan_id new signups use).
 *
 * Run: node scripts/create-razorpay-inr-v2-plans.mjs
 */

import { readFileSync } from "node:fs"

const env = readFileSync(new URL("../.env", import.meta.url), "utf8")
const getEnv = (k) => { const m = env.match(new RegExp(`^${k}=(.*)$`, "m")); return m ? m[1].trim() : "" }
const auth = "Basic " + Buffer.from(`${getEnv("RAZORPAY_KEY_ID")}:${getEnv("RAZORPAY_KEY_SECRET")}`).toString("base64")

const MONTHLY = { starter: 649, pro: 1799, agency: 4999 }
const TIER_NAMES = { starter: "Starter", pro: "Pro", agency: "Agency" }

function yearlyTotalRupees(monthly) {
    const perMonth = Math.round(monthly * 0.8)
    return perMonth * 12
}

async function createPlan(period, tier, amountRupees) {
    const amount = Math.round(amountRupees * 100) // paise
    const body = {
        period,
        interval: 1,
        item: {
            name: `Clorefy ${TIER_NAMES[tier]} INR (${period === "yearly" ? "Annual" : "Monthly"}) v2-lower`,
            amount,
            currency: "INR",
            description: `Clorefy ${TIER_NAMES[tier]} — ${period} lowered India pricing (INR)`,
        },
        notes: { plan: tier, currency: "INR", billing_cycle: period === "yearly" ? "yearly" : "monthly", platform: "clorefy", pricing_version: "in-v2-lower" },
    }
    const res = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${period}/${tier}: ${json?.error?.description || JSON.stringify(json)}`)
    return json.id
}

async function main() {
    const result = {}
    for (const tier of ["starter", "pro", "agency"]) {
        const monthlyAmt = MONTHLY[tier]
        const yearlyTotal = yearlyTotalRupees(monthlyAmt)
        const monthlyId = await createPlan("monthly", tier, monthlyAmt)
        const yearlyId = await createPlan("yearly", tier, yearlyTotal)
        result[tier] = { monthly: monthlyId, yearly: yearlyId }
        console.log(`OK  INR ${tier}: monthly=₹${monthlyAmt} -> ${monthlyId} | yearly=₹${yearlyTotal} -> ${yearlyId}`)
    }
    console.log("\n=== INR v2-lower MAPPING ===")
    console.log(JSON.stringify(result, null, 4))
}

main().catch((e) => { console.error(e); process.exit(1) })
