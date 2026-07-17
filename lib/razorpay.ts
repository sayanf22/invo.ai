/**
 * Razorpay Server-Side Integration
 * 
 * SECURITY: All payment operations happen server-side.
 * - Orders are created on the server (client cannot set amount)
 * - Signatures are verified on the server after payment
 * - Webhooks are verified using HMAC-SHA256
 * - Subscription status is only updated via server API or webhook
 */

import { getBillablePricing } from "@/lib/pricing"

// Plan pricing in paise (INR smallest unit). 1 INR = 100 paise.
export const PLANS = {
    free: {
        name: "Free",
        monthlyPrice: 0,
        yearlyPrice: 0,
        documentsPerMonth: 5,
        messagesPerSession: 10,
        features: ["Invoice + Contract", "3 PDF templates", "3 countries", "PDF export", "7-day history"],
    },
    starter: {
        name: "Starter",
        monthlyPrice: 64900,  // ₹649 in paise
        yearlyPrice: 51900,   // ₹519/mo in paise (20% off, billed annually)
        documentsPerMonth: 50,
        messagesPerSession: 25,
        features: ["Document generation platform", "All supported templates", "Global document workflows", "PDF + DOCX", "30-day history"],
    },
    pro: {
        name: "Pro",
        monthlyPrice: 179900,  // ₹1799 in paise
        yearlyPrice: 143900,   // ₹1439/mo in paise (20% off, billed annually)
        documentsPerMonth: 150,
        messagesPerSession: 30,
        features: ["Document generation platform", "All supported templates", "Global document workflows", "All export formats", "1-year history", "E-signatures", "Custom branding"],
    },
    agency: {
        name: "Agency",
        monthlyPrice: 499900,  // ₹4999 in paise
        yearlyPrice: 399900,   // ₹3999/mo in paise (20% off, billed annually)
        documentsPerMonth: -1, // unlimited
        messagesPerSession: -1,
        features: ["Everything in Pro", "Unlimited documents", "Unlimited messages", "3 team members", "Priority support", "Forever history"],
    },
} as const

type PaidTier = "starter" | "pro" | "agency"

/**
 * Per-currency monthly Plan IDs. Razorpay recurring subscriptions charge in the
 * currency of their Plan object, so international users pay in their own currency
 * by subscribing to the matching-currency plan. Created via
 * scripts/create-razorpay-currency-plans.mjs.
 */
type BillingCycle = "monthly" | "yearly"
type CyclePlanIds = { monthly: string; yearly: string }

// v2 pricing: purchasing-power-corrected ladder anchored at $15/$35/$100 (USD-equiv).
// Created via scripts/create-razorpay-plans-v2.mjs. See lib/pricing.ts for the
// rationale (currencies weaker than USD get a scaled-up numeral so nobody ever
// converts to less than the USD anchor; INR plans are untouched/reused).
export const RAZORPAY_PLAN_IDS_BY_CURRENCY: Record<string, Record<PaidTier, CyclePlanIds>> = {
    // Lowered India pricing (₹649/₹1799/₹4999) — created via
    // scripts/create-razorpay-inr-v2-plans.mjs. Old ₹999/₹2499/₹5999 plans
    // remain valid for existing subscribers (Razorpay plans are immutable and
    // cannot be deleted); new signups get these lower plan_ids.
    INR: {
        starter: { monthly: "plan_T9YVcZW782wqrV", yearly: "plan_T9YVcynGToWUXt" },
        pro: { monthly: "plan_T9YVdDh330CpPq", yearly: "plan_T9YVdSkREWjjmy" },
        agency: { monthly: "plan_T9YVdkXNz86VV1", yearly: "plan_T9YVe0GHKAJxUe" },
    },
    USD: {
        starter: { monthly: "plan_T9Xbn7v1ZfFwMl", yearly: "plan_T9XbnZbXAsz0Mi" },
        pro: { monthly: "plan_T9Xbnr0MAmQUUw", yearly: "plan_T9XboFCFkpMxbg" },
        agency: { monthly: "plan_T9XboTG6cRFbkR", yearly: "plan_T9XbopzZ7rqSYv" },
    },
    EUR: {
        starter: { monthly: "plan_T9Xbp6ZJ302OKf", yearly: "plan_T9XbpKF7Ym3hu5" },
        pro: { monthly: "plan_T9XbpXiI0oP19X", yearly: "plan_T9XbptFzeEng1g" },
        agency: { monthly: "plan_T9XbqBMgVu9kyL", yearly: "plan_T9XbqQjDycchyv" },
    },
    GBP: {
        starter: { monthly: "plan_T9XbqiH545LxTN", yearly: "plan_T9XbrDbY1hFi4S" },
        pro: { monthly: "plan_T9XbrQdClDRMgW", yearly: "plan_T9XbrdqtRY1OK0" },
        agency: { monthly: "plan_T9Xbrsk38EfXD2", yearly: "plan_T9Xbs93tkqCug0" },
    },
    CHF: {
        starter: { monthly: "plan_T9XbsOILFUDETP", yearly: "plan_T9XbsgTTPv0OK6" },
        pro: { monthly: "plan_T9Xbsx3ojxxyEy", yearly: "plan_T9XbtBd9HDG89n" },
        agency: { monthly: "plan_T9XbtRe6LxM98B", yearly: "plan_T9XbtgoTTZLgRs" },
    },
    AUD: {
        starter: { monthly: "plan_T9XbtvoBH4Ohf0", yearly: "plan_T9XbuEtXWnt2ra" },
        pro: { monthly: "plan_T9XbuUkV1hnOnU", yearly: "plan_T9Xbui36Md4qz6" },
        agency: { monthly: "plan_T9Xbuy9R7a7bdL", yearly: "plan_T9XbvH7fMFPhU6" },
    },
    CAD: {
        starter: { monthly: "plan_T9XbvYCJpJi1uh", yearly: "plan_T9XbvoTqOVhWrD" },
        pro: { monthly: "plan_T9Xbw2AGcxoqkj", yearly: "plan_T9XbwFq0d5JpzK" },
        agency: { monthly: "plan_T9XbwUoOBX5h2V", yearly: "plan_T9XbwnATOkbeJ9" },
    },
    SGD: {
        starter: { monthly: "plan_T9Xbx4k3rNdro5", yearly: "plan_T9XbxM4aUdgD91" },
        pro: { monthly: "plan_T9XbxblbdoaXgb", yearly: "plan_T9XbxpXbMjqPr5" },
        agency: { monthly: "plan_T9Xby4rIsoPs59", yearly: "plan_T9XbyKzO3BvESb" },
    },
    NZD: {
        starter: { monthly: "plan_T9XbybUvKEvU5k", yearly: "plan_T9XbyqipNMaT0R" },
        pro: { monthly: "plan_T9Xbz5r4pHJkmQ", yearly: "plan_T9XbzKQhh4M9bs" },
        agency: { monthly: "plan_T9XbzgpEUzsVLX", yearly: "plan_T9XbzuvRJp2g6m" },
    },
    HKD: {
        starter: { monthly: "plan_T9Xc09qdro7YK1", yearly: "plan_T9Xc0Qle4dBven" },
        pro: { monthly: "plan_T9Xc0h3KXXlpSG", yearly: "plan_T9Xc0w63JJZzuS" },
        agency: { monthly: "plan_T9Xc19VlbSTNFa", yearly: "plan_T9Xc1SjdFfi9fY" },
    },
    SEK: {
        starter: { monthly: "plan_T9Xc1kkDh0eZJu", yearly: "plan_T9Xc1z9v2Nk5Hj" },
        pro: { monthly: "plan_T9Xc2Id5UuXa2Q", yearly: "plan_T9Xc2YgyRsP24K" },
        agency: { monthly: "plan_T9Xc2qYXn2MiON", yearly: "plan_T9Xc36I2weKUbi" },
    },
    AED: {
        starter: { monthly: "plan_T9Xc3MFmSuENk4", yearly: "plan_T9Xc3dV8KwoYIM" },
        pro: { monthly: "plan_T9Xc3uixeEIppJ", yearly: "plan_T9Xc491JNXpftC" },
        agency: { monthly: "plan_T9Xc4PP99rWtM6", yearly: "plan_T9Xc4gSVlVawLW" },
    },
}

/**
 * Plan prices per currency+cycle in the currency's smallest unit (paise/cents).
 * Monthly = one month's charge. Yearly = the full annual charge (20% off × 12).
 * Used for record-keeping so records match the real charge.
 */
export const PLAN_PRICES_BY_CURRENCY: Record<string, Record<PaidTier, { monthly: number; yearly: number }>> = {
    INR: { starter: { monthly: 64900, yearly: 622800 }, pro: { monthly: 179900, yearly: 1726800 }, agency: { monthly: 499900, yearly: 4798800 } },
    USD: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 10000, yearly: 96000 } },
    EUR: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 10000, yearly: 96000 } },
    GBP: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 10000, yearly: 96000 } },
    CHF: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 10000, yearly: 96000 } },
    AUD: { starter: { monthly: 2400, yearly: 22800 }, pro: { monthly: 5500, yearly: 52800 }, agency: { monthly: 15500, yearly: 148800 } },
    CAD: { starter: { monthly: 2400, yearly: 22800 }, pro: { monthly: 5400, yearly: 51600 }, agency: { monthly: 15200, yearly: 146400 } },
    SGD: { starter: { monthly: 2200, yearly: 21600 }, pro: { monthly: 4900, yearly: 46800 }, agency: { monthly: 14000, yearly: 134400 } },
    NZD: { starter: { monthly: 2800, yearly: 26400 }, pro: { monthly: 6400, yearly: 61200 }, agency: { monthly: 18000, yearly: 172800 } },
    HKD: { starter: { monthly: 13000, yearly: 124800 }, pro: { monthly: 30000, yearly: 288000 }, agency: { monthly: 85000, yearly: 816000 } },
    SEK: { starter: { monthly: 14500, yearly: 139200 }, pro: { monthly: 33500, yearly: 321600 }, agency: { monthly: 95000, yearly: 912000 } },
    AED: { starter: { monthly: 5800, yearly: 55200 }, pro: { monthly: 13500, yearly: 129600 }, agency: { monthly: 37500, yearly: 360000 } },
}

/**
 * LEGACY plan IDs — no longer used for NEW subscriptions (superseded by
 * RAZORPAY_PLAN_IDS_BY_CURRENCY above), but MUST stay resolvable forever
 * because existing subscribers who signed up under the old price remain on
 * these plan_ids for the life of their subscription (Razorpay does not
 * migrate existing subscriptions when you point new signups at a different
 * plan, and plans cannot be deleted). Every renewal webhook for these
 * subscribers looks up plan/currency/cycle/amount by this exact plan_id, so
 * removing an entry here would corrupt their billing records on next renewal.
 *
 * Add a new block here (never remove one) whenever a pricing change points
 * RAZORPAY_PLAN_IDS_BY_CURRENCY at fresh plan_ids.
 */
const LEGACY_PLAN_IDS: Array<{
    id: string
    plan: PaidTier
    currency: string
    cycle: BillingCycle
    amount: number // smallest currency unit, exact price of THIS plan
}> = [
    // Original India pricing (₹999 / ₹2499 / ₹5999) — superseded by the
    // ₹649 / ₹1799 / ₹4999 plans above. Still active for subscribers who
    // joined before the price drop.
    { id: "plan_SeqvSGEJYtblYF", plan: "starter", currency: "INR", cycle: "monthly", amount: 99900 },
    { id: "plan_SeqvmVPu1FVuRx", plan: "pro", currency: "INR", cycle: "monthly", amount: 249900 },
    { id: "plan_SeqvmqZpMvvQYS", plan: "agency", currency: "INR", cycle: "monthly", amount: 599900 },
    { id: "plan_T9X5GIMe6R3Jhk", plan: "starter", currency: "INR", cycle: "yearly", amount: 958800 },
    { id: "plan_T9X5GlpHxPCuuQ", plan: "pro", currency: "INR", cycle: "yearly", amount: 2398800 },
    { id: "plan_T9X5H16prTUdjc", plan: "agency", currency: "INR", cycle: "yearly", amount: 5758800 },
    // v1 flat-numeral international pricing (15/35/80 same numeral across
    // currencies) — superseded by the PPP-corrected v2 ladder above.
    { id: "plan_T9WnghL55l3N58", plan: "starter", currency: "USD", cycle: "monthly", amount: 1500 },
    { id: "plan_T9Wnh6zWqrVP1U", plan: "pro", currency: "USD", cycle: "monthly", amount: 3500 },
    { id: "plan_T9WnhM2k72RCiU", plan: "agency", currency: "USD", cycle: "monthly", amount: 8000 },
    { id: "plan_T9WnhZnEPhBbGE", plan: "starter", currency: "EUR", cycle: "monthly", amount: 1500 },
    { id: "plan_T9WnhoiztShqYV", plan: "pro", currency: "EUR", cycle: "monthly", amount: 3500 },
    { id: "plan_T9Wni2V9pP8OIQ", plan: "agency", currency: "EUR", cycle: "monthly", amount: 8000 },
    { id: "plan_T9WniHxSUu4fF9", plan: "starter", currency: "GBP", cycle: "monthly", amount: 1500 },
    { id: "plan_T9WniWhUTPyloG", plan: "pro", currency: "GBP", cycle: "monthly", amount: 3500 },
    { id: "plan_T9WnilPGFZZ3uF", plan: "agency", currency: "GBP", cycle: "monthly", amount: 8000 },
    { id: "plan_T9Wnj0MiaeYm0T", plan: "starter", currency: "SGD", cycle: "monthly", amount: 1500 },
    { id: "plan_T9WnjHK2UN8BRY", plan: "pro", currency: "SGD", cycle: "monthly", amount: 3500 },
    { id: "plan_T9WnjVUncj8TZk", plan: "agency", currency: "SGD", cycle: "monthly", amount: 8000 },
    { id: "plan_T9WnjjzJCIJ37t", plan: "starter", currency: "CAD", cycle: "monthly", amount: 1500 },
    { id: "plan_T9Wnjyuqbvhgyk", plan: "pro", currency: "CAD", cycle: "monthly", amount: 3500 },
    { id: "plan_T9WnkDJKbOyRL8", plan: "agency", currency: "CAD", cycle: "monthly", amount: 8000 },
    { id: "plan_T9WnkSBBSrUJZR", plan: "starter", currency: "AUD", cycle: "monthly", amount: 1500 },
    { id: "plan_T9WnkgkCE38Mt5", plan: "pro", currency: "AUD", cycle: "monthly", amount: 3500 },
    { id: "plan_T9WnkuE4mnAeBy", plan: "agency", currency: "AUD", cycle: "monthly", amount: 8000 },
    { id: "plan_T9WnlB0tzk7fWn", plan: "starter", currency: "AED", cycle: "monthly", amount: 5500 },
    { id: "plan_T9WnlYCbcd4eGx", plan: "pro", currency: "AED", cycle: "monthly", amount: 13000 },
    { id: "plan_T9WnlsADM2mL9O", plan: "agency", currency: "AED", cycle: "monthly", amount: 30000 },
]

/** Currencies we can actually charge for recurring subscriptions. */
export const SUPPORTED_SUBSCRIPTION_CURRENCIES = Object.keys(RAZORPAY_PLAN_IDS_BY_CURRENCY)

/**
 * Resolve the chargeable currency for a country code.
 *
 * Uses the SAME source as the displayed price (lib/pricing getBillablePricing),
 * so what the user sees is exactly what they're charged. A country is billed in
 * its own currency only when that currency has real per-currency plans; otherwise
 * it falls back to USD. Unknown/missing country also falls back to USD.
 *
 * SECURITY: the caller must pass a SERVER-derived country (e.g. Cloudflare
 * cf-ipcountry), never a client-supplied value, to prevent currency spoofing.
 */
export function resolveSubscriptionCurrency(countryCode?: string | null): string {
    const cc = (countryCode || "").toUpperCase()
    const currency = getBillablePricing(cc).currency
    return SUPPORTED_SUBSCRIPTION_CURRENCIES.includes(currency) ? currency : "USD"
}

/** Get the Razorpay plan_id for a paid tier + currency + billing cycle. */
export function getPlanIdForCurrency(plan: PaidTier, currency: string, cycle: BillingCycle = "monthly"): string | null {
    const byCur = RAZORPAY_PLAN_IDS_BY_CURRENCY[currency?.toUpperCase()] ?? RAZORPAY_PLAN_IDS_BY_CURRENCY.INR
    return byCur[plan]?.[cycle] ?? null
}

/**
 * Reverse-map a Razorpay plan_id back to our internal plan key.
 * Checks CURRENT plans first, then LEGACY_PLAN_IDS — so subscribers on an
 * old (superseded) plan_id still resolve correctly on every renewal.
 */
export function planIdToPlan(razorpayPlanId: string): PlanId | null {
    for (const tiers of Object.values(RAZORPAY_PLAN_IDS_BY_CURRENCY)) {
        for (const [plan, ids] of Object.entries(tiers)) {
            if (ids.monthly === razorpayPlanId || ids.yearly === razorpayPlanId) return plan as PlanId
        }
    }
    const legacy = LEGACY_PLAN_IDS.find((p) => p.id === razorpayPlanId)
    return legacy?.plan ?? null
}

/** Reverse-map a Razorpay plan_id back to its currency (current or legacy). */
export function planIdToCurrency(razorpayPlanId: string): string | null {
    for (const [currency, tiers] of Object.entries(RAZORPAY_PLAN_IDS_BY_CURRENCY)) {
        for (const ids of Object.values(tiers)) {
            if (ids.monthly === razorpayPlanId || ids.yearly === razorpayPlanId) return currency
        }
    }
    const legacy = LEGACY_PLAN_IDS.find((p) => p.id === razorpayPlanId)
    return legacy?.currency ?? null
}

/** Reverse-map a Razorpay plan_id back to its billing cycle (current or legacy). */
export function planIdToCycle(razorpayPlanId: string): BillingCycle | null {
    for (const tiers of Object.values(RAZORPAY_PLAN_IDS_BY_CURRENCY)) {
        for (const ids of Object.values(tiers)) {
            if (ids.monthly === razorpayPlanId) return "monthly"
            if (ids.yearly === razorpayPlanId) return "yearly"
        }
    }
    const legacy = LEGACY_PLAN_IDS.find((p) => p.id === razorpayPlanId)
    return legacy?.cycle ?? null
}

/**
 * Get the exact price for a plan_id — checks legacy plans first so an
 * existing subscriber's renewal always records their ACTUAL grandfathered
 * price, not the current (possibly different) price for that tier/currency.
 * Falls back to PLAN_PRICES_BY_CURRENCY for current plan_ids.
 */
export function planIdToAmount(razorpayPlanId: string): number | null {
    const legacy = LEGACY_PLAN_IDS.find((p) => p.id === razorpayPlanId)
    if (legacy) return legacy.amount
    const currency = planIdToCurrency(razorpayPlanId)
    const plan = planIdToPlan(razorpayPlanId)
    const cycle = planIdToCycle(razorpayPlanId)
    // A subscription plan_id can only ever map to a PAID tier (never "free" —
    // there is no Razorpay plan for the free tier), so this narrowing is safe.
    if (!currency || !plan || plan === "free" || !cycle) return null
    return PLAN_PRICES_BY_CURRENCY[currency]?.[plan as PaidTier]?.[cycle] ?? null
}

/**
 * Fetch a subscription from Razorpay by ID (source of truth).
 * Used by the reconcile endpoint to verify + activate a payment that the
 * synchronous /verify call missed. Returns the raw subscription entity.
 */
export interface RazorpayPayment {
    id: string
    amount: number
    currency: string
    status: string
    order_id?: string | null
    invoice_id?: string | null
    subscription_id?: string | null
}

export async function getPayment(paymentId: string): Promise<RazorpayPayment | null> {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
        signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
        if (res.status === 404) return null
        const error = await res.json().catch(() => ({}))
        throw new Error(error?.error?.description || "Failed to fetch payment")
    }
    return res.json()
}

export async function getSubscription(subscriptionId: string): Promise<{
    id: string
    status: string
    plan_id: string
    payment_method?: string | null
    notes?: Record<string, string>
    current_start?: number | null
    current_end?: number | null
    has_scheduled_changes?: boolean
    change_scheduled_at?: number | null
} | null> {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
        signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
        if (res.status === 404) return null
        const error = await res.json().catch(() => ({}))
        throw new Error(error?.error?.description || "Failed to fetch subscription")
    }
    return res.json()
}

export type PlanId = keyof typeof PLANS

/** Known valid plan IDs for validation */
export const VALID_PLAN_IDS: readonly string[] = ["free", "starter", "pro", "agency"] as const

/**
 * Validate that a plan ID is one of the known plans.
 * Returns true only for: free, starter, pro, agency
 */
export function isValidPlanId(plan: unknown): plan is PlanId {
    return typeof plan === "string" && VALID_PLAN_IDS.includes(plan)
}

/**
 * Create a Razorpay Subscription for recurring billing.
 * This replaces the one-time order flow with automatic monthly charges.
 */
export async function createRazorpaySubscription(
    plan: PlanId,
    billingCycle: "monthly" | "yearly" = "monthly",
    userId?: string,
    currency: string = "INR",
    startAt?: number,
) {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")

    if (!keyId || !keySecret) {
        throw new Error("Razorpay API keys not configured")
    }

    if (plan === "free" || plan === "agency") {
        throw new Error(plan === "agency" ? "Agency plan is coming soon" : "Invalid plan for subscription")
    }

    // Pick the plan_id for the requested currency + cycle (falls back to INR if
    // the currency has no plan). This is what makes the customer pay in their own
    // currency — the subscription charges in the currency of its plan. Yearly
    // plans charge the full annual amount (20% off) once per year.
    const razorpayPlanId = getPlanIdForCurrency(plan as PaidTier, currency, billingCycle)
    if (!razorpayPlanId) {
        throw new Error("Invalid plan for subscription")
    }
    const resolvedCurrency = RAZORPAY_PLAN_IDS_BY_CURRENCY[currency?.toUpperCase()] ? currency.toUpperCase() : "INR"
    // total_count = number of billing cycles: ~10 years either way.
    const totalCount = billingCycle === "yearly" ? 10 : 120

    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        },
        body: JSON.stringify({
            plan_id: razorpayPlanId,
            total_count: totalCount,
            quantity: 1,
            ...(startAt && startAt > Math.floor(Date.now() / 1000) ? { start_at: startAt } : {}),
            notes: {
                plan,
                billing_cycle: billingCycle,
                currency: resolvedCurrency,
                platform: "clorefy",
                // user_id lets the webhook map a subscription event back to a user
                // (safety net if the synchronous verify call is missed).
                ...(userId ? { user_id: userId } : {}),
            },
        }),
    })

    if (!response.ok) {
        const error = await response.json()
        console.error("Razorpay subscription creation failed:", error)
        throw new Error(error.error?.description || "Failed to create subscription")
    }

    return response.json()
}

/**
 * Create a Razorpay order for a subscription payment.
 * This is called server-side only — the client never sets the amount.
 */
export async function createRazorpayOrder(plan: PlanId, billingCycle: "monthly" | "yearly", currency: string = "INR", amount?: number) {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")

    if (!keyId || !keySecret) {
        throw new Error("Razorpay API keys not configured")
    }

    const planConfig = PLANS[plan]
    if (!planConfig || plan === "free" || plan === "agency") {
        throw new Error(plan === "agency" ? "Agency plan is coming soon" : "Invalid plan for payment")
    }

    // If amount is provided (from country pricing), use it. Otherwise fall back to INR.
    let orderAmount: number
    if (amount) {
        // Amount is in the display currency's smallest unit
        // For currencies with decimals (USD, EUR, GBP, etc.), multiply by 100
        // For currencies without decimals (INR, PHP), amount is already in paise/centavos
        const noDecimalCurrencies = ["INR", "PHP"]
        orderAmount = noDecimalCurrencies.includes(currency)
            ? amount * 100 // INR: ₹999 → 99900 paise
            : Math.round(amount * 100) // USD: $9.99 → 999 cents
    } else {
        orderAmount = billingCycle === "yearly"
            ? planConfig.yearlyPrice * 12
            : planConfig.monthlyPrice
        currency = "INR"
    }

    // Razorpay supported currencies for international payments
    const supportedCurrencies = ["INR", "USD", "EUR", "GBP", "SGD", "AED", "CAD", "AUD", "PHP"]
    if (!supportedCurrencies.includes(currency)) {
        // Fall back to USD for unsupported currencies
        currency = "USD"
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        },
        body: JSON.stringify({
            amount: orderAmount,
            currency,
            receipt: `clorefy_${plan}_${billingCycle}_${Date.now()}`,
            notes: {
                plan,
                billing_cycle: billingCycle,
                platform: "clorefy",
            },
        }),
    })

    if (!response.ok) {
        const error = await response.json()
        console.error("Razorpay order creation failed:", error)
        throw new Error(error.error?.description || "Failed to create payment order")
    }

    return response.json()
}

/**
 * Verify Razorpay payment signature.
 * CRITICAL: This prevents payment spoofing.
 */
export async function verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    supabaseClient?: any
): Promise<boolean> {
    const { getSecret } = await import("@/lib/secrets")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    if (!keySecret) return false

    // Use Web Crypto API (edge-compatible, works on Cloudflare Workers)
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(keySecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )

    const data = encoder.encode(`${orderId}|${paymentId}`)
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")

    return expectedSignature === signature
}

/**
 * Verify Razorpay webhook signature using constant-time comparison.
 * CRITICAL: This prevents payment spoofing and timing attacks.
 */
export async function verifyWebhookSignature(
    body: string,
    signature: string,
    supabaseClient?: any
): Promise<boolean> {
    const { getSecret } = await import("@/lib/secrets")
    const webhookSecret = await getSecret("RAZORPAY_WEBHOOK_SECRET")
    if (!webhookSecret) return false

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")

    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) return false
    let diff = 0
    for (let i = 0; i < expectedSignature.length; i++) {
        diff |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return diff === 0
}

// ── Payment Links ──────────────────────────────────────────────────────

export interface CreatePaymentLinkParams {
    amount: number           // in smallest currency unit (paise for INR, cents for USD)
    currency: string         // ISO 3-letter code e.g. "INR", "USD"
    description: string      // shown on the payment page
    referenceId: string      // your invoice number — MUST be unique per link
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    sessionId?: string       // stored in notes for webhook correlation
    userId?: string          // stored in notes for webhook correlation
    acceptPartial?: boolean  // allow partial payments
    expireInDays?: number    // default: smart expiry based on industry standard
    dueDateIso?: string      // invoice due date — used for smart expiry calculation
    // User's own Razorpay credentials (money goes to their account)
    userKeyId?: string
    userKeySecret?: string
}

export interface RazorpayPaymentLink {
    id: string               // plink_xxx
    short_url: string        // https://rzp.io/i/xxx
    status: string           // created | paid | partially_paid | expired | cancelled
    amount: number
    currency: string
    reference_id: string
    expire_by: number        // unix timestamp
}

/**
 * Create a Razorpay Payment Link for an invoice.
 * Server-side only — never call from client.
 * 
 * SECURITY:
 * - Amount is set server-side from the invoice data
 * - reference_id must be unique (prevents duplicate links)
 * - notes store session/user IDs for webhook correlation
 */
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<RazorpayPaymentLink> {
    // Use user's own keys if provided — money goes to their account
    // Fall back to platform keys only if user hasn't set up their own
    let keyId: string | null = params.userKeyId ?? null
    let keySecret: string | null = params.userKeySecret ?? null

    if (!keyId || !keySecret) {
        const { getSecret } = await import("@/lib/secrets")
        keyId = await getSecret("RAZORPAY_KEY_ID")
        keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    }

    if (!keyId || !keySecret) {
        throw new Error("Razorpay API keys not configured")
    }

    // Validate amount — must be positive integer
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
        throw new Error("Amount must be a positive integer in smallest currency unit")
    }

    // Validate currency
    const supportedCurrencies = ["INR", "USD", "EUR", "GBP", "SGD", "AED", "CAD", "AUD", "PHP", "MYR"]
    if (!supportedCurrencies.includes(params.currency.toUpperCase())) {
        throw new Error(`Unsupported currency: ${params.currency}`)
    }

    // ── Smart Expiry (Industry Standard 2026) ────────────────────────────────
    // Rule: Payment link lifetime MUST outlive the full reminder sequence + grace period.
    //   - Stripe hosted invoices: 30 days after due date
    //   - QuickBooks: 37+ days (30-day sequence + 7-day grace after final notice)
    //   - Our schedule: final reminder at due+30, so link lives until due+37 at minimum
    //
    // Invariants enforced here:
    //   - Minimum lifetime: 30 days from NOW (user-specified floor — "don't expire before 1 month")
    //   - If due date given: expire 37 days AFTER due date (30-day final reminder + 7-day grace)
    //   - Cap: 180 days (Razorpay hard limit)
    let expireByUnix: number

    if (params.expireInDays !== undefined) {
        // Explicit override — but still honor the 30-day floor
        const days = Math.min(Math.max(params.expireInDays, 30), 180)
        expireByUnix = Math.floor(Date.now() / 1000) + days * 86400
    } else if (params.dueDateIso) {
        // Smart: 37 days after due date (matches final reminder day +30 + 7-day grace)
        // Minimum: 30 days from now
        const dueDate = new Date(params.dueDateIso)
        const thirtySevenAfterDue = new Date(dueDate.getTime() + 37 * 86400 * 1000)
        const thirtyFromNow = new Date(Date.now() + 30 * 86400 * 1000)
        const sixMonthsFromNow = new Date(Date.now() + 180 * 86400 * 1000)
        const expireDate = new Date(Math.max(thirtySevenAfterDue.getTime(), thirtyFromNow.getTime()))
        const capped = new Date(Math.min(expireDate.getTime(), sixMonthsFromNow.getTime()))
        expireByUnix = Math.floor(capped.getTime() / 1000)
    } else {
        // No due date given — default to 37 days (30-day final reminder + 7-day grace)
        expireByUnix = Math.floor(Date.now() / 1000) + 37 * 86400
    }

    const body: Record<string, unknown> = {
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        description: params.description.slice(0, 2048), // Razorpay max
        reference_id: params.referenceId.slice(0, 40),  // Razorpay max
        expire_by: expireByUnix,
        reminder_enable: true,  // Razorpay sends automatic reminders
        accept_partial: params.acceptPartial ?? false,
        notes: {
            session_id: params.sessionId ?? "",
            user_id: params.userId ?? "",
            platform: "clorefy",
        },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/api/razorpay/payment-link-callback`,
        callback_method: "get",
    }

    // Add customer details if provided
    // Razorpay requires contact to be 8-14 digits only (no spaces, dashes, or country code prefix)
    let cleanPhone: string | undefined
    if (params.customerPhone) {
        const digitsOnly = params.customerPhone.replace(/\D/g, "")
        // Take last 10-14 digits (strip country code if too long)
        const trimmed = digitsOnly.length > 14 ? digitsOnly.slice(-14) : digitsOnly
        if (trimmed.length >= 8 && trimmed.length <= 14) {
            cleanPhone = trimmed
        }
        // If phone doesn't fit 8-14 digits after cleaning, skip it entirely
    }

    if (params.customerName || params.customerEmail || cleanPhone) {
        body.customer = {
            ...(params.customerName ? { name: params.customerName } : {}),
            ...(params.customerEmail ? { email: params.customerEmail } : {}),
            ...(cleanPhone ? { contact: cleanPhone } : {}),
        }
    }

    const response = await fetch("https://api.razorpay.com/v1/payment_links/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000), // 15s timeout
    })

    if (!response.ok) {
        const error = await response.json()
        console.error("Razorpay payment link creation failed:", error)
        throw new Error(error.error?.description || "Failed to create payment link")
    }

    return response.json()
}

/**
 * Fetch a payment link by ID from Razorpay.
 * Used to sync status if webhook was missed.
 */
export async function getPaymentLink(paymentLinkId: string): Promise<RazorpayPaymentLink> {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")

    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const response = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}`, {
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.description || "Failed to fetch payment link")
    }

    return response.json()
}

/**
 * Cancel a Razorpay recurring Subscription so the customer stops being charged.
 *
 * @param subscriptionId - Razorpay subscription id (sub_xxx)
 * @param cancelAtCycleEnd - when true, the subscription stays active until the
 *   end of the current billing cycle and is NOT charged again (the customer
 *   keeps access until current_period_end). When false, it cancels immediately.
 *
 * Returns the updated subscription entity, or null if there is no id to cancel.
 * Throws on a genuine API error so callers can decide whether to treat it as fatal.
 */
export async function cancelRazorpaySubscription(
    subscriptionId: string | null | undefined,
    cancelAtCycleEnd: boolean = true
): Promise<{ id: string; status: string } | null> {
    if (!subscriptionId || !subscriptionId.startsWith("sub_")) return null

    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const res = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
            },
            body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
            signal: AbortSignal.timeout(10000),
        }
    )

    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        const desc = error?.error?.description || ""
        // Idempotent: if it's already cancelled, treat as success.
        if (desc.toLowerCase().includes("cancel")) return { id: subscriptionId, status: "cancelled" }
        throw new Error(desc || "Failed to cancel subscription")
    }

    return res.json()
}

/**
 * Structured error thrown by Razorpay API helpers so callers can branch on
 * `code`/`description`/`reason` reliably instead of doing fragile substring
 * matching on a generic `Error.message`. Mirrors the shape Razorpay itself
 * returns: `{ error: { code, description, source, step, reason, metadata } }`.
 */
export class RazorpayApiError extends Error {
    code?: string
    description: string
    source?: string
    step?: string
    reason?: string
    metadata?: Record<string, unknown>

    constructor(errorBody: {
        code?: string
        description?: string
        source?: string
        step?: string
        reason?: string
        metadata?: Record<string, unknown>
    }) {
        super(errorBody.description || "Razorpay API error")
        this.name = "RazorpayApiError"
        this.code = errorBody.code
        this.description = errorBody.description || ""
        this.source = errorBody.source
        this.step = errorBody.step
        this.reason = errorBody.reason
        this.metadata = errorBody.metadata
    }
}

/**
 * Update an EXISTING Razorpay recurring Subscription's plan (plan_id) via
 * Razorpay's Update Subscription API. Used by BOTH the downgrade path
 * (paid→paid downgrade, `scheduleChangeAt: "cycle_end"` — deferred, no
 * proration) and the upgrade path (paid→paid upgrade, `scheduleChangeAt:
 * "now"` — immediate, prorated). This is a SINGLE parameterized function
 * shared by both call sites; do NOT split it into separate
 * "...Now"/"...CycleEnd" variants.
 *
 * @param subscriptionId - Razorpay subscription id (sub_xxx) to update.
 * @param newPlanId - Target Razorpay plan_id (from getPlanIdForCurrency).
 * @param scheduleChangeAt - "cycle_end" (default) defers the change to the
 *   next billing cycle with no proration; "now" applies immediately and lets
 *   Razorpay prorate/charge the difference right away.
 *
 * Returns the updated subscription entity. Throws `RazorpayApiError` on a
 * genuine, non-idempotent API error so callers can inspect the structured
 * `description`/`code` (e.g. the upgrade path treats the documented
 * "difference amount... less than... smallest currency subunit" condition
 * as a successful no-op, see create-order/route.ts).
 */
export async function updateRazorpaySubscriptionPlan(
    subscriptionId: string | null | undefined,
    newPlanId: string,
    scheduleChangeAt: "now" | "cycle_end" = "cycle_end"
): Promise<{ id: string; status: string; plan_id?: string; current_start?: number | null; current_end?: number | null }> {
    if (!subscriptionId || !subscriptionId.startsWith("sub_")) {
        throw new Error("Invalid or missing Razorpay subscription id")
    }
    if (!newPlanId) {
        throw new Error("Missing target plan_id for subscription update")
    }

    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        },
        body: JSON.stringify({ plan_id: newPlanId, schedule_change_at: scheduleChangeAt }),
        signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        const desc: string = errorBody?.error?.description || ""
        // Idempotent: if the subscription is already on this plan, treat as success
        // (mirrors cancelRazorpaySubscription's idempotency handling above).
        if (desc.toLowerCase().includes("already") && desc.toLowerCase().includes("plan")) {
            return { id: subscriptionId, status: "active", plan_id: newPlanId }
        }
        throw new RazorpayApiError(errorBody?.error || { description: "Failed to update subscription plan" })
    }

    return res.json()
}

export interface RazorpayScheduledSubscriptionChange {
    id: string
    status: string
    plan_id: string
    notes?: Record<string, string>
    current_start?: number | null
    current_end?: number | null
    has_scheduled_changes?: boolean
    change_scheduled_at?: number | null
}

/** Fetch the provider-authoritative cycle-end update, if one still exists. */
export async function getRazorpayScheduledSubscriptionChange(
    subscriptionId: string,
): Promise<RazorpayScheduledSubscriptionChange | null> {
    if (!subscriptionId.startsWith("sub_")) throw new Error("Invalid Razorpay subscription id")
    const { keyId, keySecret } = await razorpayCredentials()
    const res = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/retrieve_scheduled_changes`,
        {
            headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
            signal: AbortSignal.timeout(10000),
        },
    )
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const description = String(body?.error?.description || "")
        if (res.status === 404 || /no .*scheduled|no .*pending|not found/i.test(description)) return null
        throw new RazorpayApiError(body?.error || { description: "Failed to fetch scheduled subscription change" })
    }
    const entity = await res.json()
    return entity?.has_scheduled_changes === false ? null : entity
}

/** Cancel only a provider update that is still scheduled for cycle end. */
export async function cancelRazorpayScheduledSubscriptionChange(
    subscriptionId: string,
): Promise<RazorpayScheduledSubscriptionChange> {
    if (!subscriptionId.startsWith("sub_")) throw new Error("Invalid Razorpay subscription id")
    const { keyId, keySecret } = await razorpayCredentials()
    const res = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel_scheduled_changes`,
        {
            method: "POST",
            headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
            signal: AbortSignal.timeout(10000),
        },
    )
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new RazorpayApiError(body?.error || { description: "Failed to cancel scheduled subscription change" })
    }
    return res.json()
}

export interface RazorpaySubscriptionInvoice {
    id: string
    payment_id: string | null
    order_id: string | null
    subscription_id: string
    amount: number
    amount_paid: number
    amount_due: number
    currency: string
    status: string
    issued_at: number | null
    paid_at: number | null
}

/**
 * Fetch the most recent invoice(s) for a Razorpay Subscription via
 * `GET /v1/invoices?subscription_id=:id`. Used after an immediate
 * (`schedule_change_at: "now"`) plan update to discover the REAL prorated
 * amount Razorpay charged (or determined needed no charge) — the Update
 * Subscription PATCH response itself does NOT include the charged amount,
 * only plan/period metadata.
 *
 * Returns invoices in the order Razorpay returns them (most recent first).
 * Returns an empty array (never throws) on a fetch failure, since this is a
 * best-effort lookup for billing-record accuracy, not a blocker for the
 * plan change itself having already succeeded.
 */
export async function getSubscriptionInvoices(
    subscriptionId: string,
    count: number = 1
): Promise<RazorpaySubscriptionInvoice[]> {
    try {
        return await fetchSubscriptionInvoices(subscriptionId, count)
    } catch {
        return []
    }
}

async function razorpayCredentials() {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")
    return { keyId, keySecret }
}

async function fetchSubscriptionInvoices(
    subscriptionId: string,
    count: number,
): Promise<RazorpaySubscriptionInvoice[]> {
    const { keyId, keySecret } = await razorpayCredentials()
    const res = await fetch(
        `https://api.razorpay.com/v1/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=${count}`,
        {
            headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
            signal: AbortSignal.timeout(10000),
        },
    )
    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error?.error?.description || "Failed to fetch subscription invoices")
    }
    const body = await res.json().catch(() => null)
    if (!Array.isArray(body?.items)) throw new Error("Invalid Razorpay invoice response")
    return body.items
}

async function fetchSubscriptionInvoice(invoiceId: string): Promise<RazorpaySubscriptionInvoice | null> {
    const { keyId, keySecret } = await razorpayCredentials()
    const res = await fetch(`https://api.razorpay.com/v1/invoices/${encodeURIComponent(invoiceId)}`, {
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
        signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
        if (res.status === 404) return null
        const error = await res.json().catch(() => ({}))
        throw new Error(error?.error?.description || "Failed to fetch subscription invoice")
    }
    return res.json()
}

export interface VerifiedSubscriptionCharge extends RazorpayChargeCorrelation {
    subscription: NonNullable<Awaited<ReturnType<typeof getSubscription>>>
    invoice: RazorpaySubscriptionInvoice
    payment: RazorpayPayment
}

export interface RazorpayChargeCorrelation {
    id: string
    amount: number
    currency: string
    order_id: string
    invoice_id: string
    subscription_id: string
}

function invoicePaidAt(invoice: RazorpaySubscriptionInvoice): number {
    return invoice.paid_at || invoice.issued_at || 0
}

function isExactPaidInvoice(
    invoice: RazorpaySubscriptionInvoice,
    subscriptionId: string,
    paymentId: string,
    currency: string,
    notBeforeSeconds: number,
): boolean {
    return invoice.id.startsWith("inv_")
        && invoice.subscription_id === subscriptionId
        && invoice.payment_id === paymentId
        && typeof invoice.order_id === "string"
        && invoice.order_id.startsWith("order_")
        && invoice.status === "paid"
        && Number.isSafeInteger(invoice.amount)
        && invoice.amount > 0
        && invoice.amount === invoice.amount_paid
        && invoice.amount_due === 0
        && invoice.currency?.toUpperCase() === currency
        && invoicePaidAt(invoice) >= notBeforeSeconds
}

function isExactCapturedPayment(
    payment: RazorpayPayment,
    invoice: RazorpaySubscriptionInvoice,
    subscriptionId: string,
): boolean {
    return payment.id === invoice.payment_id
        && payment.status === "captured"
        && Number.isSafeInteger(payment.amount)
        && payment.amount > 0
        && payment.amount === invoice.amount_paid
        && payment.currency?.toUpperCase() === invoice.currency.toUpperCase()
        // Razorpay does NOT populate subscription_id on the payment entity for
        // subscription charges (it is null for UPI and other methods) — it only
        // appears on the invoice. The payment↔subscription binding is already
        // proven transitively: payment.invoice_id === invoice.id here, and
        // isExactPaidInvoice enforces invoice.subscription_id === subscriptionId
        // and invoice.payment_id === payment.id. So only compare it when the
        // provider actually supplies it, instead of rejecting every real charge.
        && (payment.subscription_id == null || payment.subscription_id === subscriptionId)
        && payment.invoice_id === invoice.id
        && payment.order_id === invoice.order_id
}

/**
 * Resolve entitlement evidence exclusively from freshly fetched Razorpay
 * objects. The best-effort invoice helper above is intentionally never used:
 * missing provider evidence and any absent correlation field fail closed.
 * `notBefore` prevents an immediate plan update from reusing an older invoice.
 */
export async function getVerifiedSubscriptionCharge(
    subscriptionId: string,
    paymentId?: string,
    notBefore?: number | Date,
): Promise<VerifiedSubscriptionCharge | null> {
    if (!subscriptionId.startsWith("sub_") || (paymentId && !paymentId.startsWith("pay_"))) return null

    const subscription = await getSubscription(subscriptionId)
    if (!subscription || subscription.id !== subscriptionId || !subscription.plan_id) return null
    const expectedCurrency = planIdToCurrency(subscription.plan_id)?.toUpperCase()
    if (!expectedCurrency) return null

    const notBeforeSeconds = notBefore instanceof Date
        ? Math.floor(notBefore.getTime() / 1000)
        : typeof notBefore === "number"
            ? Math.floor(notBefore / (notBefore > 10_000_000_000 ? 1000 : 1))
            : 0

    let requestedPayment: RazorpayPayment | null = null
    let invoiceIds: string[] = []
    if (paymentId) {
        requestedPayment = await getPayment(paymentId)
        if (!requestedPayment || requestedPayment.id !== paymentId || typeof requestedPayment.invoice_id !== "string") return null
        invoiceIds = [requestedPayment.invoice_id]
    } else {
        const invoices = await fetchSubscriptionInvoices(subscriptionId, 25)
        invoiceIds = invoices
            .filter((item) =>
                item.subscription_id === subscriptionId
                && item.status === "paid"
                && typeof item.payment_id === "string"
                && item.id.startsWith("inv_")
                && invoicePaidAt(item) >= notBeforeSeconds,
            )
            .map((item) => item.id)
    }

    for (const invoiceId of invoiceIds) {
        const invoice = await fetchSubscriptionInvoice(invoiceId)
        if (!invoice || typeof invoice.payment_id !== "string") continue
        const payment = requestedPayment?.id === invoice.payment_id
            ? requestedPayment
            : await getPayment(invoice.payment_id)
        if (!payment) continue
        if (!isExactPaidInvoice(invoice, subscriptionId, payment.id, expectedCurrency, notBeforeSeconds)) continue
        if (!isExactCapturedPayment(payment, invoice, subscriptionId)) continue

        return {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency.toUpperCase(),
            order_id: payment.order_id!,
            invoice_id: invoice.id,
            subscription_id: subscriptionId,
            subscription,
            invoice,
            payment,
        }
    }
    return null
}

/**
 * Cancel a payment link.
 */
export async function cancelPaymentLink(
    paymentLinkId: string,
    userKeyId?: string,
    userKeySecret?: string,
): Promise<void> {
    let keyId = userKeyId
    let keySecret = userKeySecret
    if (!keyId || !keySecret) {
        const { getSecret } = await import("@/lib/secrets")
        keyId = await getSecret("RAZORPAY_KEY_ID")
        keySecret = await getSecret("RAZORPAY_KEY_SECRET")
    }

    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const response = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
        signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.description || "Failed to cancel payment link")
    }
}

// ── Per-User Webhook Helpers ───────────────────────────────────────────

/**
 * Generate a unique webhook secret for a user.
 * This secret is stored in DB and shown to the user so they can
 * manually add it in their Razorpay Dashboard → Settings → Webhooks.
 *
 * NOTE: Razorpay does NOT have a public API for merchants to
 * programmatically create webhooks on their own account.
 * The /v2/accounts/:id/webhooks endpoint is Partners API only.
 * 
 * The correct approach (same as Invoice Ninja with Stripe):
 * 1. Generate a webhook URL + secret for the user
 * 2. Show it in Settings UI
 * 3. User manually adds it in their Razorpay Dashboard
 * 4. Razorpay fires events to our per-user endpoint
 */
export function generateWebhookSecret(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
}

/**
 * Get the per-user webhook URL for display in Settings.
 */
export function getUserWebhookUrl(userId: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
    return `${appUrl}/api/razorpay/webhook/${userId}`
}
