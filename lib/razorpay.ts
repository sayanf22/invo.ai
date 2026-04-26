/**
 * Razorpay Server-Side Integration
 * 
 * SECURITY: All payment operations happen server-side.
 * - Orders are created on the server (client cannot set amount)
 * - Signatures are verified on the server after payment
 * - Webhooks are verified using HMAC-SHA256
 * - Subscription status is only updated via server API or webhook
 */

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
        features: ["All 4 document types", "All 9 templates", "All 11 countries", "PDF + DOCX", "30-day history"],
    },
    pro: {
        name: "Pro",
        monthlyPrice: 249900,  // ₹2499 in paise
        yearlyPrice: 199900,   // ₹1999/mo in paise
        documentsPerMonth: 150,
        messagesPerSession: 30,
        features: ["All 4 document types", "All 9 templates", "All 11 countries", "All export formats", "1-year history", "E-signatures", "Custom branding"],
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

// Razorpay Plan IDs (created via API — these are live plans)
export const RAZORPAY_PLAN_IDS = {
    starter: { monthly: "plan_SeqvSGEJYtblYF" },
    pro: { monthly: "plan_SeqvmVPu1FVuRx" },
    agency: { monthly: "plan_SeqvmqZpMvvQYS" },
} as const

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
export async function createRazorpaySubscription(plan: PlanId, billingCycle: "monthly" | "yearly" = "monthly") {
    const { getSecret } = await import("@/lib/secrets")
    const keyId = await getSecret("RAZORPAY_KEY_ID")
    const keySecret = await getSecret("RAZORPAY_KEY_SECRET")

    if (!keyId || !keySecret) {
        throw new Error("Razorpay API keys not configured")
    }

    if (plan === "free" || !RAZORPAY_PLAN_IDS[plan as keyof typeof RAZORPAY_PLAN_IDS]) {
        throw new Error("Invalid plan for subscription")
    }

    const planIds = RAZORPAY_PLAN_IDS[plan as keyof typeof RAZORPAY_PLAN_IDS]
    const razorpayPlanId = planIds.monthly // Currently only monthly plans

    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        },
        body: JSON.stringify({
            plan_id: razorpayPlanId,
            total_count: 120, // Max 10 years of monthly billing
            quantity: 1,
            notes: {
                plan,
                billing_cycle: billingCycle,
                platform: "clorefy",
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

    // ── Smart Expiry (Industry Standard) ──────────────────────────────────────
    // Stripe: "active for 10 days or more depending on when the invoice is due"
    // Zoho:   default 15 days, editable
    // Zoho Payments API: default 30 days
    // Stripe hosted invoices: expire 30 days after due date
    //
    // Our approach (best of all):
    //   - If due date is provided: expire 30 days AFTER the due date (Stripe standard)
    //   - Minimum: always at least 15 days from now (Zoho standard)
    //   - Maximum: 180 days from now (Razorpay hard limit)
    //   - If expireInDays is explicitly passed, use that (user override)
    let expireByUnix: number

    if (params.expireInDays !== undefined) {
        // Explicit override
        const days = Math.min(Math.max(params.expireInDays, 1), 180)
        expireByUnix = Math.floor(Date.now() / 1000) + days * 86400
    } else if (params.dueDateIso) {
        // Smart: 30 days after due date, minimum 15 days from now
        const dueDate = new Date(params.dueDateIso)
        const thirtyAfterDue = new Date(dueDate.getTime() + 30 * 86400 * 1000)
        const fifteenFromNow = new Date(Date.now() + 15 * 86400 * 1000)
        const sixMonthsFromNow = new Date(Date.now() + 180 * 86400 * 1000)
        const expireDate = new Date(Math.max(thirtyAfterDue.getTime(), fifteenFromNow.getTime()))
        const capped = new Date(Math.min(expireDate.getTime(), sixMonthsFromNow.getTime()))
        expireByUnix = Math.floor(capped.getTime() / 1000)
    } else {
        // Default: 30 days from now (Zoho Payments API default)
        expireByUnix = Math.floor(Date.now() / 1000) + 30 * 86400
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
            platform: "invo-ai",
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
