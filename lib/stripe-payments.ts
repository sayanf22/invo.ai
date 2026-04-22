/**
 * Stripe Payment Links — Server-side integration
 * Uses user's own Stripe Secret Key (money goes to their account)
 *
 * Stripe has a proper webhook API — we CAN register webhooks programmatically
 * using the user's secret key. This is better than Razorpay.
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
    id: string               // plink_xxx
    url: string              // https://buy.stripe.com/xxx
    active: boolean
}

/**
 * Create a Stripe Payment Link using the user's own secret key.
 * Money goes directly to their Stripe account.
 */
export async function createStripePaymentLink(params: StripePaymentLinkParams): Promise<StripePaymentLink> {
    if (!params.userSecretKey) throw new Error("Stripe secret key not configured")

    // Step 1: Create a Price (Stripe requires a Price object for Payment Links)
    const priceRes = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.userSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            "unit_amount": String(params.amount),
            "currency": params.currency.toLowerCase(),
            "product_data[name]": params.description.slice(0, 250),
            "product_data[metadata][reference_id]": params.referenceId.slice(0, 40),
            "product_data[metadata][session_id]": params.sessionId || "",
            "product_data[metadata][user_id]": params.userId || "",
        }),
    })

    if (!priceRes.ok) {
        const err = await priceRes.json()
        throw new Error(err.error?.message || "Failed to create Stripe price")
    }

    const price = await priceRes.json()

    // Step 2: Create the Payment Link
    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.userSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            "line_items[0][price]": price.id,
            "line_items[0][quantity]": "1",
            "metadata[reference_id]": params.referenceId.slice(0, 40),
            "metadata[session_id]": params.sessionId || "",
            "metadata[user_id]": params.userId || "",
            "metadata[platform]": "invo-ai",
            ...(params.customerEmail ? { "customer_creation": "always" } : {}),
            "after_completion[type]": "redirect",
            "after_completion[redirect][url]": `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/?payment=success&ref=${encodeURIComponent(params.referenceId)}`,
        }),
    })

    if (!linkRes.ok) {
        const err = await linkRes.json()
        throw new Error(err.error?.message || "Failed to create Stripe payment link")
    }

    return linkRes.json()
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
        params.append("enabled_events[]", "payment_link.completed")
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
