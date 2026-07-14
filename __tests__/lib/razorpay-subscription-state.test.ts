import { beforeEach, describe, expect, it, vi } from "vitest"

const { cancelSubscription } = vi.hoisted(() => ({ cancelSubscription: vi.fn() }))

vi.mock("@/lib/razorpay", () => ({
  cancelRazorpaySubscription: cancelSubscription,
  getSubscription: vi.fn(),
  planIdToPlan: vi.fn(() => "pro"),
  planIdToCycle: vi.fn(() => "monthly"),
  planIdToCurrency: vi.fn(() => "INR"),
  planIdToAmount: vi.fn(() => 179900),
}))

import { applyRazorpaySubscriptionSnapshot } from "@/lib/razorpay-subscription-state"

function createDb(initial: Record<string, any> | null) {
  let row = initial ? { ...initial } : null
  const payments: Record<string, any>[] = []
  const operations: string[] = []

  const db = {
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })),
          })),
          update: vi.fn((patch: Record<string, any>) => ({
            eq: vi.fn(async () => {
              operations.push("update")
              row = { ...(row || {}), ...patch }
              return { error: null }
            }),
          })),
          upsert: vi.fn(async (patch: Record<string, any>) => {
            operations.push("upsert")
            row = { ...(row || {}), ...patch }
            return { error: null }
          }),
        }
      }
      if (table === "payment_history") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_column: string, id: string) => ({
              maybeSingle: vi.fn(async () => ({ data: payments.find((payment) => payment.razorpay_payment_id === id) || null, error: null })),
            })),
          })),
          insert: vi.fn(async (payment: Record<string, any>) => {
            payments.push(payment)
            operations.push("payment")
            return { error: null }
          }),
        }
      }
      if (table === "profiles") {
        return { update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }
  return { db, getRow: () => row, payments, operations }
}

function providerEntity(start: number, end: number) {
  return {
    id: "sub_new",
    status: "authenticated",
    plan_id: "plan_pro_monthly",
    current_start: start,
    current_end: end,
  }
}

const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"

beforeEach(() => {
  vi.clearAllMocks()
  cancelSubscription.mockResolvedValue({ id: "sub_old", status: "cancelled" })
})

describe("applyRazorpaySubscriptionSnapshot", () => {
  it("keeps a future-start replacement pending instead of granting the new plan early", async () => {
    const now = Math.floor(Date.now() / 1000)
    const state = createDb({
      user_id: userId,
      plan: "starter",
      billing_cycle: "monthly",
      razorpay_subscription_id: "sub_old",
      pending_razorpay_subscription_id: "sub_new",
      pending_plan: "pro",
      pending_change_type: "upgrade",
      current_period_start: new Date((now - 1000) * 1000).toISOString(),
      current_period_end: new Date((now + 3600) * 1000).toISOString(),
    })

    const result = await applyRazorpaySubscriptionSnapshot(
      state.db as any,
      providerEntity(now + 3600, now + 7200),
      { userId, eventType: "provider.verify", eventCreatedAt: new Date() },
    )

    expect(result.scheduled).toBe(true)
    expect(result.applied).toBe(false)
    expect(state.getRow()?.plan).toBe("starter")
    expect(state.getRow()?.pending_plan).toBe("pro")
    expect(cancelSubscription).not.toHaveBeenCalled()
  })

  it("persists a replacement before cancelling the previous mandate", async () => {
    const now = Math.floor(Date.now() / 1000)
    const state = createDb({
      user_id: userId,
      plan: "starter",
      billing_cycle: "monthly",
      razorpay_subscription_id: "sub_old",
      pending_razorpay_subscription_id: "sub_new",
      current_period_start: new Date((now - 7200) * 1000).toISOString(),
      current_period_end: new Date((now - 60) * 1000).toISOString(),
    })
    cancelSubscription.mockImplementation(async () => {
      expect(state.operations).toContain("upsert")
      return { id: "sub_old", status: "cancelled" }
    })

    const result = await applyRazorpaySubscriptionSnapshot(
      state.db as any,
      providerEntity(now - 10, now + 3600),
      { userId, eventType: "subscription.activated", eventCreatedAt: new Date() },
    )

    expect(result.applied).toBe(true)
    expect(state.getRow()?.razorpay_subscription_id).toBe("sub_new")
    expect(state.getRow()?.plan).toBe("pro")
    expect(cancelSubscription).toHaveBeenCalledWith("sub_old", false)
    expect(state.getRow()?.pending_previous_subscription_id).toBeNull()
  })


  it("rejects an equal-time active event after a terminal event", async () => {
    const now = Math.floor(Date.now() / 1000)
    const watermark = new Date(now * 1000).toISOString()
    const state = createDb({
      user_id: userId,
      plan: "pro",
      billing_cycle: "monthly",
      status: "cancelled",
      razorpay_subscription_id: "sub_new",
      provider_event_created_at: watermark,
      provider_event_type: "subscription.cancelled",
      current_period_start: new Date((now - 1000) * 1000).toISOString(),
      current_period_end: new Date((now + 3600) * 1000).toISOString(),
    })

    const result = await applyRazorpaySubscriptionSnapshot(
      state.db as any,
      providerEntity(now - 1000, now + 3600),
      { userId, eventType: "subscription.activated", eventCreatedAt: new Date(watermark) },
    )

    expect(result.stale).toBe(true)
    expect(result.applied).toBe(false)
    expect(state.getRow()?.status).toBe("cancelled")
    expect(state.operations).not.toContain("upsert")
  })

  it("stores the exact provider charge instead of the catalog amount", async () => {
    const now = Math.floor(Date.now() / 1000)
    const state = createDb(null)

    const result = await applyRazorpaySubscriptionSnapshot(
      state.db as any,
      providerEntity(now - 10, now + 3600),
      {
        userId,
        eventType: "subscription.charged",
        eventCreatedAt: new Date(),
        charge: { id: "pay_exact", amount: 4321, currency: "INR", order_id: "order_exact" },
      },
    )

    expect(result.chargedAmount).toBe(4321)
    expect(state.getRow()?.amount_paid).toBe(4321)
    expect(state.payments[0]).toMatchObject({ razorpay_payment_id: "pay_exact", amount: 4321 })
  })
})