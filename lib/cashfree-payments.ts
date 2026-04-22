/**
 * Cashfree Payment Links — Server-side integration
 * Uses user's own Cashfree Client ID + Secret (money goes to their account)
 *
 * Cashfree is India-first but supports 140+ currencies internationally.
 * Best for: India (UPI, cards, net banking), also works for international.
 *
 * API: POST https://api.cashfree.com/pg/links
 * Auth: x-client-id + x-client-secret headers
 */

export interface CashfreePaymentLinkParams {
    amount: number           // in INR (or other currency, no conversion needed)
    currency: string         // "INR" for India, others for international
    description: string
    referenceId: string      // link_id — must be unique
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    sessionId?: string
    userId?: string
    clientId: string         // user's Cashfree Client ID
    clientSecret: string     // user's Cashfree Client Secret
    testMode?: boolean
}

export interface CashfreePaymentLink {
    link_id: string
    link_url: string         // https://payments.cashfree.com/links/xxx
    link_status: string      // ACTIVE | PAID | CANCELLED | EXPIRED
    link_amount: number
    link_currency: string
}

/**
 * Create a Cashfree Payment Link using the user's own credentials.
 */
export async function createCashfreePaymentLink(params: CashfreePaymentLinkParams): Promise<CashfreePaymentLink> {
    const baseUrl = params.testMode
        ? "https://sandbox.cashfree.com/pg/links"
        : "https://api.cashfree.com/pg/links"

    const body: Record<string, unknown> = {
        link_id: params.referenceId.slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, "_"),
        link_amount: params.amount,
        link_currency: params.currency.toUpperCase(),
        link_purpose: params.description.slice(0, 100),
        link_auto_reminders: true,
        link_notify: {
            send_sms: false,
            send_email: !!params.customerEmail,
        },
        link_meta: {
            notify_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/api/cashfree/webhook/${params.userId}`,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/?payment=success&ref=${encodeURIComponent(params.referenceId)}`,
        },
    }

    if (params.customerName || params.customerEmail || params.customerPhone) {
        body.customer_details = {
            customer_name: params.customerName || "Customer",
            customer_email: params.customerEmail || "",
            customer_phone: params.customerPhone || "9999999999",
        }
    }

    const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-version": "2025-01-01",
            "x-client-id": params.clientId,
            "x-client-secret": params.clientSecret,
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || err.error || "Failed to create Cashfree payment link")
    }

    return res.json()
}

/**
 * Verify Cashfree webhook signature.
 * Cashfree uses HMAC-SHA256 with the client secret.
 */
export async function verifyCashfreeWebhookSignature(
    body: string,
    signature: string,
    clientSecret: string
): Promise<boolean> {
    try {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            "raw", encoder.encode(clientSecret),
            { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        )
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
        const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
        return computed === signature
    } catch { return false }
}
