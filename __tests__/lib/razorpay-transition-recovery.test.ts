import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(), getScheduled: vi.fn(), getSubscription: vi.fn(),
  getVerified: vi.fn(), apply: vi.fn(), applyTerminal: vi.fn(),
  hasPersistedEntitlement: vi.fn(),
}))
vi.mock("@/lib/razorpay", () => ({
  cancelRazorpaySubscription: mocks.cancel,
  getRazorpayScheduledSubscriptionChange: mocks.getScheduled,
  getSubscription: mocks.getSubscription,
  getVerifiedSubscriptionCharge: mocks.getVerified,
  planIdToPlan: vi.fn((id: string) => id.includes("starter") ? "starter" : "pro"),
  planIdToCycle: vi.fn(() => "monthly"),
}))
vi.mock("@/lib/razorpay-subscription-state", () => ({
  applyRazorpaySubscriptionSnapshot: mocks.apply,
  applyRazorpayTerminalSnapshot: mocks.applyTerminal,
  hasPersistedRazorpayEntitlement: mocks.hasPersistedEntitlement,
}))

import {
  ABANDONED_CHECKOUT_TTL_MS,
  recoverPendingSubscriptionTransition,
} from "@/lib/razorpay-transition-recovery"

const now = new Date("2026-07-17T12:00:00.000Z")
const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"
const base = {
  user_id: userId, plan: "pro", billing_cycle: "monthly",
  razorpay_subscription_id: "sub_CURRENT123",
  pending_plan: "starter", pending_billing_cycle: "monthly",
  pending_change_type: "downgrade",
  pending_effective_at: "2026-08-17T12:00:00.000Z",
  current_period_end: "2026-08-17T12:00:00.000Z",
}

function db(rpcData: any = { cleared: true }) {
  const updateQuery: any = { eq: vi.fn(() => updateQuery), is: vi.fn(async () => ({ error: null })) }
  return {
    rpc: vi.fn(async () => ({ data: rpcData, error: null })),
    from: vi.fn(() => ({ update: vi.fn(() => updateQuery) })),
  }
}


beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  mocks.cancel.mockResolvedValue({ status: "cancelled" })
  mocks.getVerified.mockResolvedValue(null)
  mocks.apply.mockResolvedValue({ applied: true, stale: false, plan: "starter", billingCycle: "monthly" })
  mocks.hasPersistedEntitlement.mockResolvedValue(true)
  mocks.applyTerminal.mockResolvedValue({ applied: true, finalized: false })
})
afterEach(() => vi.useRealTimers())

describe("recoverPendingSubscriptionTransition", () => {
  it("keeps an abandoned replacement Checkout retryable and user-cancelable, never auto-cancelled", async () => {
    const client = db()
    mocks.getSubscription.mockResolvedValue({
      id: "sub_PENDING123", status: "created", plan_id: "plan_starter_monthly",
      notes: { platform: "clorefy", user_id: userId },
    })
    const result = await recoverPendingSubscriptionTransition(client as any, {
      ...base,
      pending_razorpay_subscription_id: "sub_PENDING123",
      pending_previous_subscription_id: "sub_CURRENT123",
      pending_created_at: new Date(now.getTime() - ABANDONED_CHECKOUT_TTL_MS - 1).toISOString(),
    })

    expect(result).toMatchObject({
      state: "pending", retryableCheckout: true, reason: "checkout_can_be_cancelled",
    })
    // Recovery must never silently mutate provider state or clear the pending row.
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it("keeps a recent incomplete Checkout retryable instead of locking it forever", async () => {
    mocks.getSubscription.mockResolvedValue({
      id: "sub_PENDING123", status: "created", plan_id: "plan_starter_monthly",
      notes: { platform: "clorefy", user_id: userId },
    })
    const result = await recoverPendingSubscriptionTransition(db() as any, {
      ...base,
      pending_razorpay_subscription_id: "sub_PENDING123",
      pending_created_at: new Date(now.getTime() - 60_000).toISOString(),
    })
    expect(result).toMatchObject({ state: "pending", retryableCheckout: true })
    expect(mocks.cancel).not.toHaveBeenCalled()
  })


  it("preserves a provider-confirmed future downgrade", async () => {
    mocks.getSubscription.mockResolvedValue({
      id: "sub_CURRENT123", status: "active", plan_id: "plan_pro_monthly",
      notes: { platform: "clorefy", user_id: userId },
    })
    mocks.getScheduled.mockResolvedValue({
      id: "sub_CURRENT123", status: "active", plan_id: "plan_starter_monthly",
      has_scheduled_changes: true,
    })
    const client = db()
    const result = await recoverPendingSubscriptionTransition(client as any, base)
    expect(result).toMatchObject({ state: "pending", targetPlan: "starter" })
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it("clears a stale local downgrade only after the provider confirms no scheduled update", async () => {
    mocks.getSubscription.mockResolvedValue({
      id: "sub_CURRENT123", status: "active", plan_id: "plan_pro_monthly",
      notes: { platform: "clorefy", user_id: userId },
    })
    mocks.getScheduled.mockResolvedValue(null)
    const client = db()
    const result = await recoverPendingSubscriptionTransition(client as any, base)
    expect(result).toMatchObject({ state: "cleared", reason: "provider_no_scheduled_change" })
    expect(client.rpc).toHaveBeenCalledWith("clear_subscription_transition", expect.objectContaining({
      p_reason: "provider_no_scheduled_change",
    }))
  })

  it("activates a paid target only through verified captured charge evidence", async () => {
    const provider = {
      id: "sub_CURRENT123", status: "active", plan_id: "plan_starter_monthly",
      notes: { platform: "clorefy", user_id: userId },
    }
    const charge = { id: "pay_CAPTURED123", subscription: provider }
    mocks.getSubscription.mockResolvedValue(provider)
    mocks.getVerified.mockResolvedValue(charge)
    const result = await recoverPendingSubscriptionTransition(db() as any, base)
    expect(result.state).toBe("reconciled")
    expect(mocks.apply).toHaveBeenCalledWith(expect.anything(), provider, expect.objectContaining({
      eventType: "provider.reconcile", charge,
    }))
  })

  it("clears using the exact stored transition id (compare-and-set)", async () => {
    mocks.getSubscription.mockResolvedValue({
      id: "sub_CURRENT123", status: "active", plan_id: "plan_pro_monthly",
      notes: { platform: "clorefy", user_id: userId },
    })
    mocks.getScheduled.mockResolvedValue(null)
    const client = db()
    await recoverPendingSubscriptionTransition(client as any, {
      ...base, pending_transition_id: "11111111-2222-3333-4444-555555555555",
    })
    expect(client.rpc).toHaveBeenCalledWith("clear_subscription_transition", expect.objectContaining({
      p_expected_transition_id: "11111111-2222-3333-4444-555555555555",
      p_reason: "provider_no_scheduled_change",
    }))
  })

  it("bounds deferred charge evidence to the effective boundary minus five minutes", async () => {
    const provider = {
      id: "sub_CURRENT123", status: "active", plan_id: "plan_starter_monthly",
      notes: { platform: "clorefy", user_id: userId },
    }
    mocks.getSubscription.mockResolvedValue(provider)
    mocks.getScheduled.mockResolvedValue(null)
    mocks.getVerified.mockResolvedValue(null)
    await recoverPendingSubscriptionTransition(db() as any, base)
    const expectedBoundary = Date.parse(base.pending_effective_at) - 5 * 60 * 1000
    expect(mocks.getVerified).toHaveBeenCalledWith("sub_CURRENT123", undefined, expectedBoundary)
  })

  it("retains the binding when a terminal replacement still has captured evidence", async () => {
    mocks.getSubscription.mockResolvedValue({
      id: "sub_PENDING123", status: "cancelled", plan_id: "plan_starter_monthly",
      notes: { platform: "clorefy", user_id: userId },
    })
    mocks.getVerified.mockResolvedValue({ id: "pay_CAPTURED123" })
    const client = db()
    const result = await recoverPendingSubscriptionTransition(client as any, {
      ...base,
      pending_razorpay_subscription_id: "sub_PENDING123",
      pending_previous_subscription_id: "sub_CURRENT123",
      pending_created_at: new Date(now.getTime() - 60_000).toISOString(),
    })
    expect(result).toMatchObject({
      state: "pending", reason: "captured_charge_requires_terminal_reconciliation",
    })
    expect(mocks.applyTerminal).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })
})