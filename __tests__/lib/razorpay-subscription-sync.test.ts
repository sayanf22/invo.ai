import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getSubscription: vi.fn(), getVerifiedCharge: vi.fn(), apply: vi.fn(),
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/razorpay", () => ({
  getSubscription: mocks.getSubscription,
  getVerifiedSubscriptionCharge: mocks.getVerifiedCharge,
}))
vi.mock("@/lib/razorpay-subscription-state", () => ({
  applyRazorpaySubscriptionSnapshot: mocks.apply,
}))

import { handleRazorpaySubscriptionEvent } from "@/lib/razorpay-subscription-sync"

const entity = { id: "sub_BOUND123", status: "active", plan_id: "plan_pro" }
function event(paymentId = "pay_EXACT123") {
  return {
    created_at: 1_700_000_000,
    payload: { subscription: { entity }, payment: { entity: { id: paymentId } } },
  }
}
function dbWithBinding(binding: any) {
  return {
    from: vi.fn((table: string) => {
      if (table === "subscriptions") return {
        select: vi.fn(() => ({ or: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: binding, error: null })) })) })),
      }
      if (table === "notifications") return { insert: vi.fn(async () => ({ error: null })) }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
  mocks.createClient.mockReturnValue(dbWithBinding({ user_id: "user-1" }))
  mocks.getVerifiedCharge.mockResolvedValue({
    id: "pay_EXACT123", invoice_id: "inv_EXACT123", order_id: "order_EXACT123",
    subscription_id: entity.id, amount: 100, currency: "INR", subscription: entity,
  })
  mocks.apply.mockResolvedValue({
    applied: true, stale: false, plan: "pro", billingCycle: "monthly",
  })
})

describe("Razorpay subscription webhook entitlement gating", () => {
  it.each(["subscription.activated", "subscription.updated"])("does not grant on %s", async (type) => {
    const response = await handleRazorpaySubscriptionEvent(event(), type, `evt_${type}`)
    expect(response).toBeNull()
    expect(mocks.getVerifiedCharge).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("rejects an unbound charged event before provider charge verification", async () => {
    mocks.createClient.mockReturnValue(dbWithBinding(null))
    const response = await handleRazorpaySubscriptionEvent(event(), "subscription.charged", "evt_charged")
    expect(response?.status).toBe(500)
    expect(mocks.getVerifiedCharge).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("grants a charged event only through exact verified provider evidence", async () => {
    const response = await handleRazorpaySubscriptionEvent(event(), "subscription.charged", "evt_charged")
    expect(response).toBeNull()
    expect(mocks.getVerifiedCharge).toHaveBeenCalledWith(entity.id, "pay_EXACT123")
    expect(mocks.apply).toHaveBeenCalledWith(expect.anything(), entity, expect.objectContaining({
      userId: "user-1", eventType: "subscription.charged",
      charge: expect.objectContaining({ id: "pay_EXACT123", invoice_id: "inv_EXACT123" }),
    }))
  })
})