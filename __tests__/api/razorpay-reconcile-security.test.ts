import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), createClient: vi.fn(), getSubscription: vi.fn(),
  getVerifiedCharge: vi.fn(), apply: vi.fn(), applyTerminal: vi.fn(),
  hasPersistedEntitlement: vi.fn(),
}))
vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: mocks.authenticate, validateOrigin: vi.fn(() => null),
}))
vi.mock("@/lib/csrf", () => ({ validateCSRFToken: vi.fn(() => null) }))
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: vi.fn(() => null) }))
vi.mock("@/lib/razorpay", () => ({
  getSubscription: mocks.getSubscription,
  getVerifiedSubscriptionCharge: mocks.getVerifiedCharge,
}))
vi.mock("@/lib/razorpay-subscription-state", () => ({
  applyRazorpaySubscriptionSnapshot: mocks.apply,
  applyRazorpayTerminalSnapshot: mocks.applyTerminal,
  hasPersistedRazorpayEntitlement: mocks.hasPersistedEntitlement,
}))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn(async () => undefined) }))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))

const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"
const subscriptionId = "sub_BOUND123"
function request() {
  return new NextRequest("https://clorefy.com/api/razorpay/reconcile", {
    method: "POST", headers: { origin: "https://clorefy.com" },
  })
}
function service(row: any) {
  return { from: vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })) })),
  })) }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
  mocks.authenticate.mockResolvedValue({ error: null, user: { id: userId }, supabase: {} })
  mocks.createClient.mockReturnValue(service({
    user_id: userId, plan: "free", pending_razorpay_subscription_id: subscriptionId,
    razorpay_subscription_id: null,
  }))
  mocks.getSubscription.mockResolvedValue({
    id: subscriptionId, status: "active", plan_id: "plan_pro",
    notes: { platform: "clorefy", user_id: userId },
    current_start: Math.floor(Date.now() / 1000) - 60,
    current_end: Math.floor(Date.now() / 1000) + 3600,
  })
  mocks.getVerifiedCharge.mockResolvedValue(null)
  mocks.hasPersistedEntitlement.mockResolvedValue(true)
  mocks.applyTerminal.mockResolvedValue({
    applied: true, stale: false, finalized: true, pendingCleared: false,
    periodEnd: "2026-07-16T10:34:44.816Z",
  })
})

describe("Razorpay reconcile entitlement hardening", () => {
  it("does not activate a bound subscription without an exact paid invoice charge", async () => {
    const { POST } = await import("@/app/api/razorpay/reconcile/route")
    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(202)
    expect(body).toEqual({ activated: false, reason: "no_verified_charge" })
    expect(mocks.getVerifiedCharge).toHaveBeenCalledWith(subscriptionId)
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("never probes provider IDs that are not locally bound", async () => {
    mocks.createClient.mockReturnValue(service(null))
    const { POST } = await import("@/app/api/razorpay/reconcile/route")
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.getSubscription).not.toHaveBeenCalled()
    expect(mocks.getVerifiedCharge).not.toHaveBeenCalled()
  })

  it("reconciles a bound terminal provider state without inventing a paid charge", async () => {
    mocks.createClient.mockReturnValue(service({
      user_id: userId, plan: "pro", razorpay_subscription_id: subscriptionId,
    }))
    mocks.getSubscription.mockResolvedValueOnce({
      id: subscriptionId, status: "cancelled",
      notes: { platform: "clorefy", user_id: userId },
      current_end: 1_784_198_084,
    })
    const { POST } = await import("@/app/api/razorpay/reconcile/route")
    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ activated: false, terminal: true, finalized: true })
    expect(mocks.applyTerminal).toHaveBeenCalled()
    expect(mocks.getVerifiedCharge).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })
})