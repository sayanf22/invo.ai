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
        monthlyPrice: 99900,  // ₹999 in paise
        yearlyPrice: 79900,   // ₹799/mo in paise
        documentsPerMonth: 50,
        messagesPerSession: 25,
        features: ["Document generation platform", "All supported templates", "Global document workflows", "PDF + DOCX", "30-day history"],
    },
    pro: {
        name: "Pro",
        monthlyPrice: 249900,  // ₹2499 in paise
        yearlyPrice: 199900,   // ₹1999/mo in paise
        documentsPerMonth: 150,
        messagesPerSession: 30,
        features: ["Document generation platform", "All supported templates", "Global document workflows", "All export formats", "1-year history", "E-signatures", "Custom branding"],
    },
    agency: {
        name: "Agency",
        monthlyPrice: 599900,  // ₹5999 in paise
        yearlyPrice: 479900,   // ₹4799/mo in paise
        documentsPerMonth: -1, // unlimited
        messagesPerSession: -1,
        features: ["Everything in Pro", "Unlimited documents", "Unlimited messages", "3 team members", "Priority support", "Forever history"],
    },
} as const

// Razorpay Plan IDs (created via API — these are live plans).
// Legacy INR-only map kept for backward compatibility.
export const RAZORPAY_PLAN_IDS = {
    starter: { monthly: "plan_SeqvSGEJYtblYF" },
    pro: { monthly: "plan_SeqvmVPu1FVuRx" },
    agency: { monthly: "plan_SeqvmqZpMvvQYS" },
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

export const RAZORPAY_PLAN_IDS_BY_CURRENCY: Record<string, Record<PaidTier, CyclePlanIds>> = {
    INR: {
        starter: { monthly: "plan_SeqvSGEJYtblYF", yearly: "plan_T9X5GIMe6R3Jhk" },
        pro: { monthly: "plan_SeqvmVPu1FVuRx", yearly: "plan_T9X5GlpHxPCuuQ" },
        agency: { monthly: "plan_SeqvmqZpMvvQYS", yearly: "plan_T9X5H16prTUdjc" },
    },
    USD: {
        starter: { monthly: "plan_T9WnghL55l3N58", yearly: "plan_T9X5HFYfgjEuF6" },
        pro: { monthly: "plan_T9Wnh6zWqrVP1U", yearly: "plan_T9X5HYFnrbGOAI" },
        agency: { monthly: "plan_T9WnhM2k72RCiU", yearly: "plan_T9X5HpVbKBi3Ym" },
    },
    EUR: {
        starter: { monthly: "plan_T9WnhZnEPhBbGE", yearly: "plan_T9X5I5eZYmiVNh" },
        pro: { monthly: "plan_T9WnhoiztShqYV", yearly: "plan_T9X5IMqoIuN4Pm" },
        agency: { monthly: "plan_T9Wni2V9pP8OIQ", yearly: "plan_T9X5IgQxj6UcEX" },
    },
    GBP: {
        starter: { monthly: "plan_T9WniHxSUu4fF9", yearly: "plan_T9X5Iw0h7XAXwk" },
        pro: { monthly: "plan_T9WniWhUTPyloG", yearly: "plan_T9X5J9MJLuAIne" },
        agency: { monthly: "plan_T9WnilPGFZZ3uF", yearly: "plan_T9X5JO5DyhfYyF" },
    },
    SGD: {
        starter: { monthly: "plan_T9Wnj0MiaeYm0T", yearly: "plan_T9X5Jbo6oSBSMs" },
        pro: { monthly: "plan_T9WnjHK2UN8BRY", yearly: "plan_T9X5JrnJNnOA1v" },
        agency: { monthly: "plan_T9WnjVUncj8TZk", yearly: "plan_T9X5K8BZoP1aP8" },
    },
    AED: {
        starter: { monthly: "plan_T9WnlB0tzk7fWn", yearly: "plan_T9X5LqO7O6hXuq" },
        pro: { monthly: "plan_T9WnlYCbcd4eGx", yearly: "plan_T9X5M6F0vpbmwn" },
        agency: { monthly: "plan_T9WnlsADM2mL9O", yearly: "plan_T9X5MmcEbx6vSM" },
    },
    CAD: {
        starter: { monthly: "plan_T9WnjjzJCIJ37t", yearly: "plan_T9X5KOGVRMW1y3" },
        pro: { monthly: "plan_T9Wnjyuqbvhgyk", yearly: "plan_T9X5KeN5fOHl9c" },
        agency: { monthly: "plan_T9WnkDJKbOyRL8", yearly: "plan_T9X5KvmGLSwfr7" },
    },
    AUD: {
        starter: { monthly: "plan_T9WnkSBBSrUJZR", yearly: "plan_T9X5L9UoSFWUab" },
        pro: { monthly: "plan_T9WnkgkCE38Mt5", yearly: "plan_T9X5LMiWC57ex0" },
        agency: { monthly: "plan_T9WnkuE4mnAeBy", yearly: "plan_T9X5LbSBPp7JF4" },
    },
}

/**
 * Plan prices per currency+cycle in the currency's smallest unit (paise/cents).
 * Monthly = one month's charge. Yearly = the full annual charge (20% off × 12).
 * Used for record-keeping so records match the real charge.
 */
export const PLAN_PRICES_BY_CURRENCY: Record<string, Record<PaidTier, { monthly: number; yearly: number }>> = {
    INR: { starter: { monthly: 99900, yearly: 958800 }, pro: { monthly: 249900, yearly: 2398800 }, agency: { monthly: 599900, yearly: 5758800 } },
    USD: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 8000, yearly: 76800 } },
    EUR: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 8000, yearly: 76800 } },
    GBP: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 8000, yearly: 76800 } },
    SGD: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 8000, yearly: 76800 } },
    AED: { starter: { monthly: 5500, yearly: 52800 }, pro: { monthly: 13000, yearly: 124800 }, agency: { monthly: 30000, yearly: 288000 } },
    CAD: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 8000, yearly: 76800 } },
    AUD: { starter: { monthly: 1500, yearly: 14400 }, pro: { monthly: 3500, yearly: 33600 }, agency: { monthly: 8000, yearly: 76800 } },
}

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

/** Reverse-map a Razorpay plan_id back to our internal plan key (any currency/cycle). */
export function planIdToPlan(razorpayPlanId: string): PlanId | null {
    for (const tiers of Object.values(RAZORPAY_PLAN_IDS_BY_CURRENCY)) {
        for (const [plan, ids] of Object.entries(tiers)) {
            if (ids.monthly === razorpayPlanId || ids.yearly === razorpayPlanId) return plan as PlanId
        }
    }
    return null
}

/** Reverse-map a Razorpay plan_id back to its currency. */
export function planIdToCurrency(razorpayPlanId: string): string | null {
    for (const [currency, tiers] of Object.entries(RAZORPAY_PLAN_IDS_BY_CURRENCY)) {
        for (const ids of Object.values(tiers)) {
            if (ids.monthly === razorpayPlanId || ids.yearly === razorpayPlanId) return currency
        }
    }
    return null
}

/** Reverse-map a Razorpay plan_id back to its billing cycle. */
export function planIdToCycle(razorpayPlanId: string): BillingCycle | null {
    for (const tiers of Object.values(RAZORPAY_PLAN_IDS_BY_CURRENCY)) {
        for (const ids of Object.values(tiers)) {
            if (ids.monthly === razorpayPlanId) return "monthly"
            if (ids.yearly === razorpayPlanId) return "yearly"
        }
    }
    return null
}

/**
 * Fetch a subscription from Razorpay by ID (source of truth).
 * Used by the reconcile endpoint to verify + activate a payment that the
 * synchronous /verify call missed. Returns the raw subscription entity.
 */
export async function getSubscription(subscriptionId: string): Promise<{
    id: string
    status: string
    plan_id: string
    notes?: Record<string, string>
    current_start?: number | null
    current_end?: number | null
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
    currency: string = "INR"
) {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")

    if (!keyId || !keySecret) {
        throw new Error("Razorpay API keys not configured")
    }

    if (plan === "free") {
        throw new Error("Invalid plan for subscription")
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
    if (!planConfig || plan === "free") {
        throw new Error("Invalid plan for payment")
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
 * Cancel a payment link.
 */
export async function cancelPaymentLink(paymentLinkId: string): Promise<void> {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")

    if (!keyId || !keySecret) throw new Error("Razorpay API keys not configured")

    const response = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
    })

    if (!response.ok) {
        const error = await response.json()
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
