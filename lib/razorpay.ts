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
        documentsPerMonth: 3,
        messagesPerSession: 10,
        features: ["Invoice + Contract", "3 PDF templates", "3 countries", "PDF export", "7-day history"],
    },
    starter: {
        name: "Starter",
        monthlyPrice: 90000,  // ₹900 in paise ($9 equivalent)
        yearlyPrice: 70000,   // ₹700/mo in paise ($7 equivalent)
        documentsPerMonth: 50,
        messagesPerSession: 25,
        features: ["All 4 document types", "All 9 templates", "All 11 countries", "PDF + DOCX", "30-day history"],
    },
    pro: {
        name: "Pro",
        monthlyPrice: 240000,  // ₹2400 in paise ($24 equivalent)
        yearlyPrice: 190000,   // ₹1900/mo in paise ($19 equivalent)
        documentsPerMonth: 150,
        messagesPerSession: 30,
        features: ["All 4 document types", "All 9 templates", "All 11 countries", "All export formats", "1-year history", "E-signatures", "Custom branding"],
    },
    agency: {
        name: "Agency",
        monthlyPrice: 590000,  // ₹5900 in paise ($59 equivalent)
        yearlyPrice: 470000,   // ₹4700/mo in paise ($47 equivalent)
        documentsPerMonth: -1, // unlimited
        messagesPerSession: -1,
        features: ["Everything in Pro", "Unlimited documents", "Unlimited messages", "3 team members", "Priority support", "Forever history"],
    },
} as const

export type PlanId = keyof typeof PLANS

/**
 * Create a Razorpay order for a subscription payment.
 * This is called server-side only — the client never sets the amount.
 */
export async function createRazorpayOrder(plan: PlanId, billingCycle: "monthly" | "yearly", currency: string = "INR", amount?: number) {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

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
    signature: string
): Promise<boolean> {
    const keySecret = process.env.RAZORPAY_KEY_SECRET
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
 * Verify Razorpay webhook signature.
 * CRITICAL: This prevents fake webhook calls.
 */
export async function verifyWebhookSignature(
    body: string,
    signature: string
): Promise<boolean> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
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

    return expectedSignature === signature
}
