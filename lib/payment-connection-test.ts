// Server-only helpers: only imported by API routes. Kept dependency-free so it
// mirrors lib/encrypt.ts and stays testable in the node/vitest environment.
const TIMEOUT_MS = 15_000

export type ProviderCheckFailure =
  | "invalid_credentials"
  | "provider_unavailable"
  | "unexpected_response"

export interface ProviderConnectionCheck {
  ok: boolean
  httpStatus: number
  failure?: ProviderCheckFailure
  account?: {
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    detailsSubmitted?: boolean
  }
}

function classifyFailure(status: number): ProviderConnectionCheck {
  if (status === 401 || status === 403) {
    return { ok: false, httpStatus: status, failure: "invalid_credentials" }
  }
  if (status === 429 || status >= 500 || status === 0) {
    return { ok: false, httpStatus: status, failure: "provider_unavailable" }
  }
  return { ok: false, httpStatus: status, failure: "unexpected_response" }
}

async function safeFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return null
  }
}

export async function checkRazorpayConnection(
  keyId: string,
  keySecret: string
): Promise<ProviderConnectionCheck> {
  const response = await safeFetch("https://api.razorpay.com/v1/payment_links?count=1", {
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
  })
  if (!response) return classifyFailure(0)
  return response.ok ? { ok: true, httpStatus: response.status } : classifyFailure(response.status)
}
export async function checkStripeConnection(secretKey: string): Promise<ProviderConnectionCheck> {
  const response = await safeFetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!response) return classifyFailure(0)
  if (!response.ok) return classifyFailure(response.status)

  const account = await response.json().catch(() => null)
  return {
    ok: true,
    httpStatus: response.status,
    account: {
      chargesEnabled: typeof account?.charges_enabled === "boolean" ? account.charges_enabled : undefined,
      payoutsEnabled: typeof account?.payouts_enabled === "boolean" ? account.payouts_enabled : undefined,
      detailsSubmitted: typeof account?.details_submitted === "boolean" ? account.details_submitted : undefined,
    },
  }
}

export async function checkCashfreeConnection(
  clientId: string,
  clientSecret: string,
  testMode: boolean
): Promise<ProviderConnectionCheck> {
  const baseUrl = testMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com"
  const probeId = `clorefy_connection_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
  const response = await safeFetch(`${baseUrl}/pg/links/${probeId}`, {
    headers: {
      "x-api-version": "2025-01-01",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    },
  })
  if (!response) return classifyFailure(0)

  // The random link must not exist. A 404 proves Cashfree authenticated the
  // request without creating a payment resource; 200 is also safe to accept.
  if (response.ok || response.status === 404) {
    return { ok: true, httpStatus: response.status }
  }
  return classifyFailure(response.status)
}

export function connectionFailureMessage(provider: string, check: ProviderConnectionCheck): string {
  if (check.failure === "invalid_credentials") return `${provider} rejected the saved credentials.`
  if (check.failure === "provider_unavailable") return `${provider} did not respond. Your saved verification was kept; try again shortly.`
  return `${provider} returned an unexpected response while testing the connection.`
}

export function connectionFailureStatus(check: ProviderConnectionCheck): number {
  if (check.failure === "invalid_credentials") return 422
  if (check.failure === "provider_unavailable") return 503
  return 502
}
