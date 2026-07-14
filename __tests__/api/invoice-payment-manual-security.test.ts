import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  validateOrigin: vi.fn(),
  validateBodySize: vi.fn(),
  validateCsrf: vi.fn(),
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
  getCredentials: vi.fn(),
  cancelProviderLink: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: mocks.authenticate,
  validateOrigin: mocks.validateOrigin,
  validateBodySize: mocks.validateBodySize,
}))
vi.mock("@/lib/csrf", () => ({ validateCSRFToken: mocks.validateCsrf }))
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/payment-credentials", () => ({ getUserPaymentCredentials: mocks.getCredentials }))
vi.mock("@/lib/payment-link-provider", () => ({ cancelProviderLink: mocks.cancelProviderLink }))

const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"
const sessionId = "12345678-1234-4123-8123-123456789012"
const authSupabase = { rpc: vi.fn() }
const invoiceContext = {
  items: [{ quantity: 2, rate: 12.5, discount: 0 }],
  discountType: "percent",
  discountValue: 0,
  taxRate: 0,
  shippingFee: 0,
  currency: "USD",
  invoiceNumber: "INV-SEC-1",
}

function request(body: Record<string, unknown> = {}) {
  return new NextRequest("https://clorefy.com/api/payments/mark-paid", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify({ sessionId, paymentMethod: "cash", ...body }),
  })
}

function buildDb(options: {
  active?: Record<string, unknown> | null
  rpcData?: unknown
} = {}) {
  const sessionResult = {
    data: { id: sessionId, user_id: userId, document_type: "invoice", context: invoiceContext },
    error: null,
  }
  const activeResult = { data: options.active ?? null, error: null }
  const rpc = vi.fn().mockResolvedValue({ data: options.rpcData ?? { applied: true }, error: null })
  const from = vi.fn((table: string) => {
    if (table === "document_sessions") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(sessionResult) })) })),
        })),
      }
    }
    if (table === "invoice_payments") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(activeResult) })),
            })),
          })),
        })),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { db: { from, rpc }, rpc }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mocks.validateOrigin.mockReturnValue(null)
  mocks.authenticate.mockResolvedValue({
    error: null,
    user: { id: userId },
    supabase: authSupabase,
  })
  mocks.validateCsrf.mockResolvedValue(null)
  mocks.checkRateLimit.mockResolvedValue(null)
  mocks.validateBodySize.mockReturnValue(null)
  mocks.getCredentials.mockResolvedValue({ stripe: { secretKey: "sk_test" } })
  mocks.cancelProviderLink.mockResolvedValue(undefined)
  mocks.createClient.mockReturnValue(buildDb().db)
})

describe("POST /api/payments/mark-paid security", () => {
  it("rejects an invalid origin before authentication", async () => {
    const blocked = Response.json({ error: "Invalid origin" }, { status: 403 })
    mocks.validateOrigin.mockReturnValue(blocked)
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request())

    expect(response).toBe(blocked)
    expect(mocks.authenticate).not.toHaveBeenCalled()
    expect(mocks.validateCsrf).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("rejects a CSRF failure before rate limiting", async () => {
    const blocked = Response.json({ error: "Invalid CSRF token" }, { status: 403 })
    mocks.validateCsrf.mockResolvedValue(blocked)
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request())

    expect(response).toBe(blocked)
    expect(mocks.validateCsrf).toHaveBeenCalledWith(expect.anything(), userId, authSupabase)
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("rejects a rate-limited request before database access", async () => {
    const blocked = Response.json({ error: "Too many requests" }, { status: 429 })
    mocks.checkRateLimit.mockResolvedValue(blocked)
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request())

    expect(response).toBe(blocked)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(userId, "payment", authSupabase)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("rejects an invalid manual payment method", async () => {
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request({ paymentMethod: "credit_card" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid payment method" })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("rejects an invalid paidAt timestamp", async () => {
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request({ paidAt: "not-a-date" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid paidAt timestamp" })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("cancels an active provider link before recording manual payment", async () => {
    const { db, rpc } = buildDb({
      active: {
        gateway: "stripe",
        razorpay_payment_link_id: "correlation-1",
        provider_link_id: "cs_test_active",
      },
    })
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.cancelProviderLink).toHaveBeenCalledWith(
      "stripe",
      "correlation-1",
      "cs_test_active",
      { stripe: { secretKey: "sk_test" } },
    )
    expect(mocks.cancelProviderLink.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0])
  })

  it("returns 502 and does not record payment when provider cancellation fails", async () => {
    const { db, rpc } = buildDb({
      active: {
        gateway: "stripe",
        razorpay_payment_link_id: "correlation-1",
        provider_link_id: "cs_test_active",
      },
    })
    mocks.createClient.mockReturnValue(db)
    mocks.cancelProviderLink.mockRejectedValue(new Error("provider unavailable"))
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: "Could not cancel the active online payment link. Manual payment was not recorded.",
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("passes server-derived amount and currency to the RPC despite malicious client fields", async () => {
    const { db, rpc } = buildDb()
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request({ amount: 1, currency: "XXX" }))

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("mark_invoice_manually_paid", expect.objectContaining({
      p_user_id: userId,
      p_session_id: sessionId,
      p_amount: 2500,
      p_currency: "USD",
    }))
  })

  it("returns 409 when the RPC reports that the invoice is already paid", async () => {
    const { db } = buildDb({ rpcData: { applied: false, reason: "already_paid" } })
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/payments/mark-paid/route")

    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: "This invoice was already paid; no manual payment was added.",
    })
  })
})
