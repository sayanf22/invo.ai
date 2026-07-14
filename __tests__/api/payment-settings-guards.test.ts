import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  validateOrigin: vi.fn(),
  validateBodySize: vi.fn(),
  validateCsrf: vi.fn(),
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: mocks.authenticate,
  validateOrigin: mocks.validateOrigin,
  validateBodySize: mocks.validateBodySize,
}))
vi.mock("@/lib/csrf", () => ({ validateCSRFToken: mocks.validateCsrf }))
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/encrypt", () => ({ encrypt: vi.fn(), decrypt: vi.fn() }))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/sanitize", () => ({ sanitizeSQLInput: (value: string) => value }))
vi.mock("@/lib/razorpay", () => ({ generateWebhookSecret: vi.fn(() => "secret") }))
vi.mock("@/lib/stripe-payments", () => ({
  registerStripeWebhook: vi.fn(), deleteStripeWebhook: vi.fn(),
}))

const auth = { error: null, user: { id: "user-1" }, supabase: { rpc: vi.fn() } }

function postRequest() {
  return new NextRequest("https://clorefy.com/api/payments/settings", {
    method: "POST", body: JSON.stringify({ gateway: "invalid" }),
    headers: { "content-type": "application/json", origin: "https://clorefy.com" },
  })
}

function deleteRequest() {
  return new NextRequest("https://clorefy.com/api/payments/settings?gateway=invalid", {
    method: "DELETE", headers: { origin: "https://clorefy.com" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.validateOrigin.mockReturnValue(null)
  mocks.authenticate.mockResolvedValue(auth)
  mocks.validateCsrf.mockResolvedValue(null)
  mocks.checkRateLimit.mockResolvedValue(null)
  mocks.validateBodySize.mockReturnValue(null)
})

describe("payment settings mutation guards", () => {
  it("rejects an invalid origin before authentication", async () => {
    const blocked = Response.json({ error: "Invalid origin" }, { status: 403 })
    mocks.validateOrigin.mockReturnValue(blocked)
    const { POST } = await import("@/app/api/payments/settings/route")

    const response = await POST(postRequest())

    expect(response).toBe(blocked)
    expect(mocks.authenticate).not.toHaveBeenCalled()
    expect(mocks.validateCsrf).not.toHaveBeenCalled()
  })

  it("rejects a missing CSRF token before rate limiting", async () => {
    const blocked = Response.json({ error: "Invalid CSRF token" }, { status: 403 })
    mocks.validateCsrf.mockResolvedValue(blocked)
    const { POST } = await import("@/app/api/payments/settings/route")

    const response = await POST(postRequest())

    expect(response).toBe(blocked)
    expect(mocks.validateCsrf).toHaveBeenCalledWith(expect.anything(), "user-1", auth.supabase)
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
  })

  it("rejects a rate-limited DELETE before touching payment settings", async () => {
    const blocked = Response.json({ error: "Too many requests" }, { status: 429 })
    mocks.checkRateLimit.mockResolvedValue(blocked)
    const { DELETE } = await import("@/app/api/payments/settings/route")

    const response = await DELETE(deleteRequest())

    expect(response).toBe(blocked)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("user-1", "payment", auth.supabase)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("runs origin, authentication, CSRF, and rate guards before body handling", async () => {
    const { POST } = await import("@/app/api/payments/settings/route")
    const response = await POST(postRequest())

    expect(response.status).toBe(400)
    expect(mocks.validateOrigin).toHaveBeenCalledOnce()
    expect(mocks.authenticate).toHaveBeenCalledOnce()
    expect(mocks.validateCsrf).toHaveBeenCalledOnce()
    expect(mocks.checkRateLimit).toHaveBeenCalledOnce()
  })
})