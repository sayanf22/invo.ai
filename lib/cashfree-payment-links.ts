/**
 * Cashfree Payment Links — Server-side integration
 * Uses user's own Cashfree Client ID + Secret (money goes to their account)
 *
 * API: https://www.cashfree.com/docs/api-reference/payments/latest/payment-links/create
 * Countries: India (primary)
 *
 * Production fixes applied:
 * 1. link_id uses sessionId (UUID) as base — globally unique per merchant, no collisions
 * 2. customer_phone is omitted when not provided — no fake placeholder numbers
 * 3. Webhook lookup uses cf_link_id stored in razorpay_payment_link_id column
 */

export interface CashfreePaymentLinkParams {
  amount: number           // in paise (smallest unit) — we convert to rupees internally
  currency: string         // "INR"
  description: string      // link_purpose
  referenceId: string      // invoice number — stored in link_notes for reference
  sessionId: string        // used as the unique link_id base (UUID = globally unique)
  customerName?: string
  customerEmail?: string
  customerPhone?: string   // optional — omitted if not provided (no fake placeholder)
  userId?: string
  testMode?: boolean
  userClientId: string
  userClientSecret: string
  expireInDays?: number
}

export interface CashfreePaymentLink {
  cf_link_id: string       // Cashfree's internal numeric ID — store this for webhook lookup
  link_id: string          // our link_id (sessionId-based)
  link_url: string         // https://payments.cashfree.com/links/xxx
  link_status: string      // ACTIVE | PAID | CANCELLED | EXPIRED
  link_amount: number
  link_currency: string
}

/**
 * Create a Cashfree Payment Link using the user's own credentials.
 * Money goes directly to their Cashfree account.
 *
 * link_id strategy: use sessionId (UUID) as base — this is globally unique per merchant
 * and avoids any collision with invoice reference numbers.
 *
 * Webhook correlation: Cashfree sends cf_link_id in the webhook. We store cf_link_id
 * in invoice_payments.razorpay_payment_link_id so the webhook handler can look it up.
 */
export async function createCashfreePaymentLink(params: CashfreePaymentLinkParams): Promise<CashfreePaymentLink> {
  if (!params.userClientId || !params.userClientSecret) {
    throw new Error("Cashfree credentials not configured")
  }

  const baseUrl = params.testMode
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com"

  // Cashfree link_amount is in full rupees, not paise
  const amountInRupees = params.amount / 100

  // Expiry
  const expireDays = params.expireInDays ?? 30
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + expireDays)
  // Cashfree requires IST offset format
  const expiryIso = expiryDate.toISOString().replace("Z", "+05:30")

  // Use sessionId as link_id — UUID is globally unique, no collision possible
  // Cashfree link_id max length is 50 chars; UUID is 36 chars, safe.
  const linkId = `cf_${params.sessionId.replace(/-/g, "").slice(0, 32)}`

  const body: Record<string, unknown> = {
    link_id: linkId,
    link_amount: amountInRupees,
    link_currency: params.currency.toUpperCase() || "INR",
    link_purpose: params.description.slice(0, 100),
    link_auto_reminders: true,
    link_expiry_time: expiryIso,
    link_meta: {
      notify_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/api/cashfree/webhook/${params.userId || ""}`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/?payment=success&session=${encodeURIComponent(params.sessionId)}`,
    },
    link_notes: {
      session_id: params.sessionId,
      user_id: params.userId || "",
      platform: "invo-ai",
      reference_id: params.referenceId,
    },
  }

  // Only add customer_details if we have real data
  // Cashfree phone is optional in v2025-01-01 — omit entirely rather than use fake number
  const hasCustomerData = params.customerName || params.customerEmail || params.customerPhone
  if (hasCustomerData) {
    body.customer_details = {
      ...(params.customerName ? { customer_name: params.customerName } : {}),
      ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
      ...(params.customerPhone ? { customer_phone: params.customerPhone } : {}),
    }
  }
  // If no customer data at all, omit customer_details entirely
  // Cashfree v2025-01-01 does not require customer_details for payment links

  const res = await fetch(`${baseUrl}/pg/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2025-01-01",
      "x-client-id": params.userClientId,
      "x-client-secret": params.userClientSecret,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as any)?.message || (err as any)?.error || "Failed to create Cashfree payment link"
    throw new Error(msg)
  }

  return res.json()
}

/**
 * Cancel a Cashfree payment link by link_id.
 */
export async function cancelCashfreePaymentLink(
  linkId: string,
  clientId: string,
  clientSecret: string,
  testMode = false
): Promise<void> {
  const baseUrl = testMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com"
  await fetch(`${baseUrl}/pg/links/${linkId}/cancel`, {
    method: "POST",
    headers: {
      "x-api-version": "2025-01-01",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    },
  })
}

/**
 * Verify Cashfree webhook signature.
 * Cashfree uses HMAC-SHA256 of the raw body with the client secret.
 * The signature is base64-encoded.
 */
export async function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(clientSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    )
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))
    const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    return computed === signature
  } catch { return false }
}
