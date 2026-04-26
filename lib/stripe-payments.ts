/**
 * Stripe Checkout Session — Server-side integration for invoice payments
 * Uses user's own Stripe Secret Key (money goes to their account)
 *
 * We use Checkout Sessions (NOT Payment Links) because:
 * - Checkout Sessions are single-use — one session per invoice, cannot be reused
 * - Payment Links are permanent/reusable — wrong for invoices
 * - Stripe's own docs say: "Use invoices to collect one-time payments from a specific customer"
 * - Checkout Sessions expire (default 24h), matching invoice payment expectations
 *
 * Countries: USA, UK, Germany, Canada, Australia, Singapore, UAE, France, Netherlands
 * (NOT India — Stripe is invite-only in India since May 2024)
 */

export interface StripePaymentLinkParams {
    amount: number           // in smallest currency unit (cents for USD, pence for GBP, etc.)
    currency: string         // ISO 3-letter code e.g. "USD", "GBP"
    description: string
    referenceId: string      // invoice number — stored in metadata
    customerEmail?: string
    sessionId?: string
    userId?: string
    userSecretKey: string    // user's own Stripe secret key
}

export interface StripePaymentLink {
    id: string               // cs_xxx (Checkout Session ID)
    url: string              // https://checkout.stripe.com/pay/cs_xxx
    active: boolean
}

/**
 * Create a Stripe Checkout Session for a one-time invoice payment.
 * Uses Checkout Sessions (not Payment Links) — single-use, expires after 24h.
 * Money goes directly to the user's Stripe account.
 */
export async function createStripePaymentLink(params: StripePaymentLinkParams): Promise<StripePaymentLink> {
    if (!params.userSecretKey) throw new Error("Stripe secret key not configured")

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"

    // Build form-encoded body for Stripe API
    const formData = new URLSearchParams()
    formData.append("mode", "payment")
    formData.append("line_items[0][price_data][currency]", params.currency.toLowerCase())
    formData.append("line_items[0][price_data][unit_amount]", String(params.amount))
    formData.append("line_items[0][price_data][product_data][name]", params.description.slice(0, 250))
    formData.append("line_items[0][quantity]", "1")
    formData.append("metadata[reference_id]", params.referenceId.slice(0, 40))
    formData.append("metadata[session_id]", params.sessionId || "")
    formData.append("metadata[user_id]", params.userId || "")
    formData.append("metadata[platform]", "invo-ai")
    formData.append("success_url", `${appUrl}/?payment=success&ref=${encodeURIComponent(params.referenceId)}`)
    formData.append("cancel_url", `${appUrl}/view/${params.sessionId || ""}`)
    // Expire after 24 hours (Stripe max is 24h for Checkout Sessions)
    formData.append("expires_at", String(Math.floor(Date.now() / 1000) + 86400))

    if (params.customerEmail) {
        formData.append("customer_email", params.customerEmail)
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.userSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
    })

    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || "Failed to create Stripe Checkout Session")
    }

    const session = await res.json()
    return {
        id: session.id,
        url: session.url,
        active: session.status === "open",
    }
}

/**
 * Register a webhook on the user's Stripe account programmatically.
 * Stripe DOES support this via API — unlike Razorpay.
 */
export async function registerStripeWebhook(
    userSecretKey: string,
    userId: string
): Promise<{ webhookId: string; webhookSecret: string } | null> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
    const webhookUrl = `${appUrl}/api/stripe/webhook/${userId}`

    try {
        const params = new URLSearchParams()
        params.append("url", webhookUrl)
        params.append("enabled_events[]", "checkout.session.completed")
        params.append("enabled_events[]", "checkout.session.expired")
        params.append("description", "Invo.ai payment notifications")

        const res = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${userSecretKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
        })

        if (!res.ok) {
            const err = await res.json()
            console.error("Stripe webhook registration failed:", err)
            return null
        }

        const data = await res.json()
        return {
            webhookId: data.id,
            webhookSecret: data.secret, // Stripe returns the signing secret on creation
        }
    } catch (err) {
        console.error("Stripe webhook registration error:", err)
        return null
    }
}

/**
 * Delete a webhook from the user's Stripe account.
 */
export async function deleteStripeWebhook(userSecretKey: string, webhookId: string): Promise<void> {
    try {
        await fetch(`https://api.stripe.com/v1/webhook_endpoints/${webhookId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${userSecretKey}` },
        })
    } catch { /* silent */ }
}

/**
 * Verify Stripe webhook signature.
 */
export async function verifyStripeWebhookSignature(
    body: string,
    signature: string,
    webhookSecret: string
): Promise<boolean> {
    try {
        // Stripe uses: t=timestamp,v1=signature format
        const parts = signature.split(",")
        const tPart = parts.find(p => p.startsWith("t="))
        const v1Part = parts.find(p => p.startsWith("v1="))
        if (!tPart || !v1Part) return false

        const timestamp = tPart.slice(2)
        const expectedSig = v1Part.slice(3)
        const payload = `${timestamp}.${body}`

        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            "raw", encoder.encode(webhookSecret),
            { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        )
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
        const computed = Array.from(new Uint8Array(sigBuffer))
            .map(b => b.toString(16).padStart(2, "0")).join("")

        return computed === expectedSig
    } catch { return false }
}
