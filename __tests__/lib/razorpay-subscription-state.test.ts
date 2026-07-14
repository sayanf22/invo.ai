import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  getSubscription: vi.fn(),
}))

vi.mock("@/lib/razorpay", () => ({
  cancelRazorpaySubscription: mocks.cancel,
  getSubscription: mocks.getSubscription,
  planIdToPlan: vi.fn((id: string) => id.includes("starter") ? "starter" : "pro"),
  planIdToCycle: vi.fn(() => "monthly"),
  planIdToCurrency: vi.fn(() => "INR"),
}))

import { applyRazorpaySubscriptionSnapshot } from "@/lib/razorpay-subscription-state"

const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"
const now = () => Math.floor(Date.now() / 1000)

function live(overrides: Record<string, any> = {}) {
  return {
    id: "sub_new",
    status: "active",
    plan_id: "plan_pro_monthly",
    notes: { platform: "clorefy", user_id: userId },
    current_start: now() - 60,
    current_end: now() + 3600,
    ...overrides,
  }
}

function charge(overrides: Record<string, any> = {}) {
  return {
    id: "pay_exact",
    amount: 4321,
    currency: "INR",
    order_id: "order_exact",
    invoice_id: "inv_exact",
    subscription_id: "sub_new",
    ...overrides,
  }
}

function createDb(initial: Record<string, any> | null) {
  let row = initial ? { ...initial } : null
  const operations: string[] = []
  const rpc = vi.fn(async (_name: string, args: Record<string, any>) => {
    operations.push("payment")
    operations.push("entitlement")
    row = {
      ...row,
      plan: args.p_plan,
      razorpay_subscription_id: args.p_subscription_id,
      amount_paid: args.p_amount,
      entitlement_source: "razorpay",
      entitlement_payment_id: args.p_payment_id,
    }
    return { data: { applied: true }, error: null }
  })
  const db = {
    rpc,
    from: vi.fn((table: string) => {
      if (table !== "subscriptions") throw new Error(`Unexpected table ${table}`)
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) })),
        })),
        update: vi.fn((patch: Record<string, any>) => ({
          eq: vi.fn(async () => {
            operations.push("update")
            row = { ...row, ...patch }
            return { error: null }
          }),
        })),
      }
    }),
  }
  return { db, rpc, operations, getRow: () => row }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSubscription.mockResolvedValue(live())
  mocks.cancel.mockResolvedValue({ id: "sub_old", status: "cancelled" })
})

describe("applyRazorpaySubscriptionSnapshot paid-entitlement hardening", () => {
  it("always uses the live subscription instead of webhook plan or notes", async () => {
    const { db, rpc } = createDb({
      user_id: userId, plan: "starter", razorpay_subscription_id: "sub_new",
      current_period_start: new Date((now() - 3600) * 1000).toISOString(),
      current_period_end: new Date((now() - 60) * 1000).toISOString(),
    })

    const result = await applyRazorpaySubscriptionSnapshot(db as any, {
      id: "sub_new", plan_id: "plan_starter_monthly",
      notes: { platform: "attacker", user_id: "other" },
    }, { userId, eventType: "subscription.charged", charge: charge() })

    expect(result.applied).toBe(true)
    expect(result.plan).toBe("pro")
    expect(mocks.getSubscription).toHaveBeenCalledWith("sub_new")
    expect(rpc).toHaveBeenCalledWith("apply_subscription_charge_event", expect.objectContaining({
      p_plan: "pro", p_payment_id: "pay_exact", p_invoice_id: "inv_exact",
    }))
  })

  it("rejects an unbound subscription even when its live notes match", async () => {
    const { db, rpc } = createDb({ user_id: userId, plan: "free" })
    await expect(applyRazorpaySubscriptionSnapshot(db as any, live(), {
      userId, eventType: "subscription.charged", charge: charge(),
    })).rejects.toThrow("not locally bound")
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(["subscription.activated", "subscription.updated"])("never grants for %s", async (eventType) => {
    const { db, rpc } = createDb({ user_id: userId, razorpay_subscription_id: "sub_new" })
    await expect(applyRazorpaySubscriptionSnapshot(db as any, live(), {
      userId, eventType, charge: charge(),
    })).rejects.toThrow("cannot grant")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("keeps a future replacement scheduled without applying its entitlement", async () => {
    mocks.getSubscription.mockResolvedValue(live({
      current_start: now() + 3600, current_end: now() + 7200,
    }))
    const { db, rpc, getRow } = createDb({
      user_id: userId, plan: "starter", razorpay_subscription_id: "sub_old",
      pending_razorpay_subscription_id: "sub_new", pending_previous_subscription_id: "sub_old",
    })
    const result = await applyRazorpaySubscriptionSnapshot(db as any, live(), {
      userId, eventType: "provider.verify", charge: null,
    })
    expect(result).toMatchObject({ applied: false, scheduled: true, plan: "pro" })
    expect(getRow()?.plan).toBe("starter")
    expect(getRow()?.pending_plan).toBe("pro")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("requires positive charge correlation and matching plan currency", async () => {
    const { db, rpc } = createDb({ user_id: userId, razorpay_subscription_id: "sub_new" })
    await expect(applyRazorpaySubscriptionSnapshot(db as any, live(), {
      userId, eventType: "subscription.charged", charge: charge({ currency: "USD" }),
    })).rejects.toThrow("verified positive captured")
    expect(rpc).not.toHaveBeenCalled()
  })
})