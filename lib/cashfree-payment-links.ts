/**
 * Cashfree Payment Links — Server-side integration
 * Uses user's own Cashfree Client ID + Secret (money goes to their account)
 *
 * API: https://www.cashfree.com/docs/api-reference/payments/latest/payment-links/create
 * Countries: India (primary), also supports international
 */

export interface CashfreePaymentLinkParams {
  amount: number           // in INR (not paise — Cashfree uses full rupees)
  currency: string         // "INR" (Cashfree primarily supports INR for payment links)
  description: string      // link_purpose
  referenceId: string      // link_id — must be unique
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  sessionId?: string
  userId?: string
  testMode?: boolean
  userClientId: string
  userClientSecret: string
  expireInDays?: number
}

export interface CashfreePaymentLink {
  cf_link_id: string       // internal Cashfree ID
  link_id: string          // your reference ID
  link_url: string         // https://payments.cashfree.com/links/xxx
  link_status: string      // ACTIVE | PAID | CANCELLED | EXPIRED
  link_amount: number
  link_currency: string
}

/**
 * Create a Cashfree Payment Link using the user's own credentials.
 * Money goes directly to their Cashfree account.
 *
 * Note: Cashfree link_amount is in full currency units (INR, not paise).
 * Note: link_id must be unique per merchant account.
 */
export async function createCashfreePaymentLink(params: CashfreePaymentLinkParams): Promise<CashfreePaymentLink> {
  if (!params.userClientId || !params.userClientSecret) {
    throw new Error("Cashfree credentials not configured")
  }

  const baseUrl = params.testMode
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com"

  // Cashfree link_amount is in full units (INR), not paise
  // Our amount is already in paise (smallest unit), so divide by 100
  const amountInRupees = params.amount / 100

  // Expiry: default 30 days
  const expireDays = params.expireInDays ?? 30
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + expireDays)
  // Cashfree format: "2021-10-14T15:04:05+05:30"
  const expiryIso = expiryDate.toISOString().replace("Z", "+05:30")

  // link_id must be unique — use referenceId + timestamp suffix to avoid collisions
  const linkId = `${params.referenceId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30)}_${Date.now()}`

  const body: Record<string, unknown> = {
    link_id: linkId,
    link_amount: amountInRupees,
    link_currency: params.currency.toUpperCase() || "INR",
    link_purpose: params.description.slice(0, 100),
    link_auto_reminders: true,
    link_expiry_time: expiryIso,
    link_meta: {
      notify_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/api/cashfree/webhook/${params.userId || ""}`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/?payment=success&ref=${encodeURIComponent(params.referenceId)}`,
    },
    link_notes: {
      session_id: params.sessionId || "",
      user_id: params.userId || "",
      platform: "invo-ai",
      reference_id: params.referenceId,
    },
  }

  // Add customer details if provided
  if (params.customerName || params.customerEmail || params.customerPhone) {
    body.customer_details = {
      ...(params.customerName ? { customer_name: params.customerName } : {}),
      ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
      // Cashfree requires phone — use placeholder if not provided
      customer_phone: params.customerPhone || "9999999999",
    }
  } else {
    // Cashfree requires customer_details with at minimum customer_phone
    body.customer_details = { customer_phone: "9999999999" }
  }

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
 * Cancel a Cashfree payment link.
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
 * Cashfree uses HMAC-SHA256 with the webhook secret.
 */
export async function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    )
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))
    const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    return computed === signature
  } catch { return false }
}
