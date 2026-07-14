import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getSubscription: vi.fn(),
  getVerifiedCharge: vi.fn(),
  applySnapshot: vi.fn(),
  createNotification: vi.fn(),
  serviceFrom: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: mocks.authenticate,
  validateOrigin: vi.fn(() => null),
  validateBodySize: vi.fn(() => null),
}))
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn(() => null),
}))
vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(() => null),
}))
vi.mock("@/lib/razorpay", () => ({
  verifyPaymentSignature: vi.fn(async () => true),
  getSubscription: mocks.getSubscription,
  getVerifiedSubscriptionCharge: mocks.getVerifiedCharge,
  isValidPlanId: vi.fn(() => true),
  planIdToPlan: vi.fn(() => "pro"),
  cancelRazorpaySubscription: vi.fn(),
}))
vi.mock("@/lib/razorpay-subscription-state", () => ({
  applyRazorpaySubscriptionSnapshot: mocks.applySnapshot,
}))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn(async () => undefined) }))
vi.mock("@/lib/notifications", () => ({
  createNotification: mocks.createNotification,
  PLAN_NAMES: { pro: "Pro" },
}))
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mocks.serviceFrom })),
}))

const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"
const paymentBody = {
  razorpay_payment_id: "pay_ABCDEF123",
  razorpay_subscription_id: "sub_ABCDEF123",
  razorpay_signature: "a".repeat(64),
  plan: "pro",
}

function request() {
  return new NextRequest("https://clorefy.com/api/razorpay/verify", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify(paymentBody),
  })
}

function provider(owner = userId) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: paymentBody.razorpay_subscription_id,
    status: "active",
    plan_id: "plan_pro_monthly",
    notes: { platform: "clorefy", user_id: owner },
    current_start: now - 60,
    current_end: now + 2_592_000,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mocks.authenticate.mockResolvedValue({
    error: null,
    user: { id: userId, email: "owner@example.com" },
    supabase: { from: vi.fn() },
  })
  mocks.getSubscription.mockResolvedValue(provider())
  mocks.getVerifiedCharge.mockResolvedValue({
    id: paymentBody.razorpay_payment_id,
    amount: 500,
    currency: "INR",
    order_id: "order_EXACT123",
    invoice_id: "inv_EXACT123",
    subscription_id: paymentBody.razorpay_subscription_id,
    subscription: provider(),
    invoice: { id: "inv_EXACT123" },
    payment: { id: paymentBody.razorpay_payment_id, status: "captured" },
  })
  mocks.applySnapshot.mockResolvedValue({
    applied: true,
    scheduled: false,
    stale: false,
    cleanupPending: false,
    plan: "pro",
    billingCycle: "monthly",
    periodEnd: new Date(Date.now() + 2_592_000_000).toISOString(),
    chargedAmount: null,
  })
  mocks.createNotification.mockResolvedValue(undefined)
  mocks.serviceFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({
        data: {
          user_id: userId,
          razorpay_subscription_id: null,
          pending_razorpay_subscription_id: paymentBody.razorpay_subscription_id,
        },
        error: null,
      })) })),
    })),
  })
})

describe("Razorpay checkout ownership enforcement", () => {
  it("rejects a subscription that is not locally bound to the authenticated user", async () => {
    mocks.serviceFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
      })),
    })
    const { POST } = await import("@/app/api/razorpay/verify/route")

    const response = await POST(request())

    expect(response.status).toBe(403)
    expect(mocks.getSubscription).not.toHaveBeenCalled()
    expect(mocks.applySnapshot).not.toHaveBeenCalled()
  })

  it("rejects a valid provider tuple owned by another authenticated user", async () => {
    mocks.getSubscription.mockResolvedValue(provider("11111111-1111-4111-8111-111111111111"))
    const { POST } = await import("@/app/api/razorpay/verify/route")

    const response = await POST(request())

    expect(response.status).toBe(403)
    expect(mocks.applySnapshot).not.toHaveBeenCalled()
  })

  it("does not grant access while the exact provider payment is unavailable", async () => {
    mocks.getVerifiedCharge.mockResolvedValue(null)
    const { POST } = await import("@/app/api/razorpay/verify/route")

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.pending).toBe(true)
    expect(mocks.applySnapshot).not.toHaveBeenCalled()
  })

  it("does not grant access for a failed or refunded payment state", async () => {
    mocks.getVerifiedCharge.mockResolvedValue(null)
    const { POST } = await import("@/app/api/razorpay/verify/route")

    const response = await POST(request())

    expect(response.status).toBe(202)
    expect(mocks.applySnapshot).not.toHaveBeenCalled()
  })

  it("applies only an exact captured invoice-linked subscription charge", async () => {
    const { POST } = await import("@/app/api/razorpay/verify/route")

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.applySnapshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: paymentBody.razorpay_subscription_id }),
      expect.objectContaining({
        userId,
        charge: expect.objectContaining({
          id: paymentBody.razorpay_payment_id,
          invoice_id: "inv_EXACT123",
          subscription_id: paymentBody.razorpay_subscription_id,
        }),
      }),
    )
  })
})
