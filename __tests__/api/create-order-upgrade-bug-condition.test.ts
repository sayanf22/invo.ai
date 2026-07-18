/**
 * Bug Condition Exploration Test — Paid Upgrade Must Update Existing Razorpay
 * Subscription, Not Create a New One
 *
 * app/api/razorpay/create-order/route.ts
 *
 * This test encodes the EXPECTED (fixed) behavior: when a user with an
 * existing, updatable-state (authenticated/active) paid Razorpay subscription
 * requests an upgrade to a higher tier, the handler SHOULD call Razorpay's
 * Update Subscription API (`plan_id` = target tier's plan_id,
 * `schedule_change_at: "now"`) on the SAME existing subscription, and SHOULD
 * NOT create a brand-new subscription.
 *
 * CRITICAL: This test MUST FAIL on unfixed code. `create-order`'s current
 * POST handler has no existing-subscription check at all — it unconditionally
 * calls `createRazorpaySubscription()` for every request, regardless of
 * whether the caller already has an active paid subscription. Failure here
 * confirms the bug exists (a brand-new subscription is created and the old
 * one is left running, unreferenced, and will double-charge on its own
 * original schedule).
 *
 * DO NOT fix the route or the test based on this failure — this is
 * expected and documented below.
 *
 * Validates: Requirements 1.2
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(),
  validateOrigin: vi.fn().mockReturnValue(null),
  validateBodySize: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
}))

const mockCreateRazorpaySubscription = vi.fn()
const mockGetSubscription = vi.fn()
const mockGetSubscriptionInvoices = vi.fn()
const mockGetVerifiedSubscriptionCharge = vi.fn()
const mockUpdateRazorpaySubscriptionPlan = vi.fn()
const mockGetPlanIdForCurrency = vi.fn()
const mockPlanIdToPlan = vi.fn().mockReturnValue(null)
const mockPlanIdToCycle = vi.fn().mockReturnValue(null)
const mockResolveSubscriptionCurrency = vi.fn().mockReturnValue("INR")

class MockRazorpayApiError extends Error {
  code?: string
  description: string
  constructor(body: { description?: string }) {
    super(body.description || "Razorpay API error")
    this.description = body.description || ""
  }
}

vi.mock("@/lib/razorpay", () => ({
  // Actually used by the (unfixed) route today:
  createRazorpaySubscription: mockCreateRazorpaySubscription,
  resolveSubscriptionCurrency: mockResolveSubscriptionCurrency,
  PLANS: {
    free: { name: "Free" },
    starter: { name: "Starter" },
    pro: { name: "Pro" },
    agency: { name: "Agency" },
  },
  PLAN_PRICES_BY_CURRENCY: {
    INR: {
      starter: { monthly: 64900, yearly: 622800 },
      pro: { monthly: 179900, yearly: 1726800 },
      agency: { monthly: 499900, yearly: 4798800 },
    },
  },
  // Not used by the unfixed route, but wired up here for when the fix (task
  // 7.6/7.7) adds the existing-subscription lookup + update-plan call.
  getSubscription: mockGetSubscription,
  getSubscriptionInvoices: mockGetSubscriptionInvoices,
  getVerifiedSubscriptionCharge: mockGetVerifiedSubscriptionCharge,
  updateRazorpaySubscriptionPlan: mockUpdateRazorpaySubscriptionPlan,
  getPlanIdForCurrency: mockGetPlanIdForCurrency,
  planIdToPlan: mockPlanIdToPlan,
  planIdToCycle: mockPlanIdToCycle,
  RazorpayApiError: MockRazorpayApiError,
}))

vi.mock("@/lib/razorpay-subscription-state", () => ({
  applyRazorpaySubscriptionSnapshot: vi.fn(),
}))

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("mock-key-id"),
}))

const mockSvcFrom = vi.fn()

function mutationQuery(result: { data?: any; error?: any } = { data: { user_id: "user-abc" }, error: null }) {
  const query: any = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (value: any) => unknown) => Promise.resolve(resolve(result)),
  }
  return query
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockSvcFrom })),
}))

import { authenticateRequest } from "@/lib/api-auth"

// ── Helpers ────────────────────────────────────────────────────────────

const mockUser = { id: "user-abc" }
const EXISTING_SUBSCRIPTION_ID = "sub_ABC"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/razorpay/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify(body),
  })
}

/**
 * Mocks a Supabase client whose `subscriptions` table read returns a row for
 * a user with an existing, active paid Razorpay subscription — this is the
 * "existing subscription" lookup the FIXED route is expected to perform
 * (task 7.6). The unfixed route never queries this table at all, so wiring
 * it up here has no effect on unfixed behavior — it's here so the same test
 * will exercise the real lookup once the fix lands (task 7.10).
 */
function buildSupabaseMockWithExistingSubscription(currentPlan: string) {
  const row = {
    plan: currentPlan,
    razorpay_subscription_id: EXISTING_SUBSCRIPTION_ID,
    currency: "INR",
    billing_cycle: "monthly",
    status: "active",
    current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
  }
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
              single: vi.fn().mockResolvedValue({ data: row, error: null }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      }
    }),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Bug Condition Exploration: create-order upgrade must update existing Razorpay subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateRazorpaySubscription.mockResolvedValue({ id: "sub_BRAND_NEW_XYZ" })
    // getSubscription() reports the existing subscription is in an updatable
    // state ("active"), per the task's mocking instructions.
    mockGetSubscription.mockResolvedValue({
      id: EXISTING_SUBSCRIPTION_ID,
      status: "active",
      plan_id: "plan_current_old",
      payment_method: "card",
      current_start: 1700000000,
      current_end: 1702592000,
    })
    mockGetPlanIdForCurrency.mockReturnValue("plan_target_new")
    mockUpdateRazorpaySubscriptionPlan.mockResolvedValue({
      id: EXISTING_SUBSCRIPTION_ID,
      status: "active",
      current_start: 1700000000,
      current_end: 1702592000,
    })
    mockResolveSubscriptionCurrency.mockReturnValue("INR")
    mockGetSubscriptionInvoices.mockResolvedValue([])
    mockGetVerifiedSubscriptionCharge.mockResolvedValue(null)
    // Service-role client chain used for subscriptions.update() and
    // payment_history.select()/insert().
    mockSvcFrom.mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          update: vi.fn(() => mutationQuery()),
          insert: vi.fn(() => mutationQuery()),
        }
      }
      if (table === "payment_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }
    })
  })

  const scopedUpgradeCases = [
    { currentPlan: "starter", targetPlan: "pro", label: "Starter→Pro" },
  ] as const

  for (const { currentPlan, targetPlan, label } of scopedUpgradeCases) {
    it(`${label} (CARD): immediate same-cycle upgrade provisions a fresh replacement subscription (Model B — full charge), NOT an in-place prorated update`, async () => {
      vi.mocked(authenticateRequest).mockResolvedValue({
        error: null,
        user: mockUser as any,
        supabase: buildSupabaseMockWithExistingSubscription(currentPlan) as any,
      })

      const { POST } = await import("@/app/api/razorpay/create-order/route")
      const response = await POST(makeRequest({ plan: targetPlan, billingCycle: "monthly" }))
      const body = await response.json()

      // Model B (Option A): a same-cycle tier upgrade is provisioned the SAME
      // way for EVERY payment method — a fresh replacement subscription that
      // starts now and charges the full new-plan price. The in-place prorated
      // "now" update is deliberately NOT used for card upgrades (proration
      // keeps the old cycle end and only charges the difference).
      expect(mockCreateRazorpaySubscription).toHaveBeenCalledTimes(1)
      expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()

      // The client receives the standard Checkout shape so it opens Checkout
      // for re-authorization; the upgrade is immediate (not a deferred/
      // scheduled change) and activates only after the verified charge.
      expect(response.status).toBe(200)
      expect(body.subscriptionId).toBeDefined()
      expect(body.keyId).toBeDefined()
      expect(body.reauthorizeUpgrade).toBe(true)
      expect(body.immediateUpgrade).toBe(true)
      expect(body.scheduledChange).toBe(false)
      expect(body.upgraded).toBeUndefined()
    })
  }

  // ── UPI / eMandate upgrade: re-authorise a new mandate ─────────────────
  // Razorpay can't update UPI/eMandate subscriptions in place, so the upgrade
  // must create a NEW subscription (user re-authorises via Checkout). The old
  // one is cancelled by /verify only after the new is confirmed active.
  for (const method of ["upi", "emandate"] as const) {
    it(`Starter→Pro (${method.toUpperCase()}): should create a NEW subscription for re-auth and NOT call the in-place update API`, async () => {
      mockGetSubscription.mockResolvedValue({
        id: EXISTING_SUBSCRIPTION_ID,
        status: "active",
        plan_id: "plan_current_old",
        payment_method: method,
        current_start: 1700000000,
        current_end: 1702592000,
      })
      vi.mocked(authenticateRequest).mockResolvedValue({
        error: null,
        user: mockUser as any,
        supabase: buildSupabaseMockWithExistingSubscription("starter") as any,
      })

      const { POST } = await import("@/app/api/razorpay/create-order/route")
      const response = await POST(makeRequest({ plan: "pro", billingCycle: "monthly" }))
      const body = await response.json()

      // In-place update API must NOT be used for non-card methods.
      expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
      // A new subscription is created for re-authorisation.
      expect(mockCreateRazorpaySubscription).toHaveBeenCalledTimes(1)
      // Client receives the standard Checkout shape (so it opens Checkout),
      // flagged as a re-authorise upgrade.
      expect(body.subscriptionId).toBeDefined()
      expect(body.keyId).toBeDefined()
      expect(body.reauthorizeUpgrade).toBe(true)
      expect(body.upgraded).toBeUndefined()
    })
  }

  it("schedules a same-tier monthly-to-yearly card switch at cycle end without an immediate charge", async () => {
    mockPlanIdToPlan.mockReturnValue("pro")
    mockPlanIdToCycle.mockReturnValue("monthly")
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMockWithExistingSubscription("pro") as any,
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "pro", billingCycle: "yearly" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockUpdateRazorpaySubscriptionPlan).toHaveBeenCalledWith(
      EXISTING_SUBSCRIPTION_ID,
      "plan_target_new",
      "cycle_end",
    )
    expect(body.deferredToNextCycle).toBe(true)
    expect(body.targetBillingCycle).toBe("yearly")
    expect(mockCreateRazorpaySubscription).not.toHaveBeenCalled()
  })

  it("rejects only an exact same-tier and same-cycle no-op", async () => {
    mockPlanIdToPlan.mockReturnValue("pro")
    mockPlanIdToCycle.mockReturnValue("monthly")
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMockWithExistingSubscription("pro") as any,
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "pro", billingCycle: "monthly" }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe("SAME_PLAN")
    expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
    expect(mockCreateRazorpaySubscription).not.toHaveBeenCalled()
  })

  it("rejects direct Agency checkout while the plan is coming soon", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMockWithExistingSubscription("pro") as any,
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "agency", billingCycle: "monthly" }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.code).toBe("AGENCY_COMING_SOON")
    expect(mockCreateRazorpaySubscription).not.toHaveBeenCalled()
    expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
  })

  it("does not charge or activate an immediate card upgrade synchronously — it defers to the verified-charge path after Checkout", async () => {
    mockPlanIdToPlan.mockReturnValue("starter")
    mockPlanIdToCycle.mockReturnValue("monthly")
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMockWithExistingSubscription("starter") as any,
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "pro", billingCycle: "monthly" }))
    const body = await response.json()

    // Under Model B (Option A) the card upgrade is a fresh replacement
    // subscription authorized via Checkout — create-order NEVER flips the plan
    // or verifies a charge itself. Activation happens strictly later in the
    // /verify (or reconcile/webhook) path once the captured charge is proven.
    expect(response.status).toBe(200)
    expect(mockCreateRazorpaySubscription).toHaveBeenCalledTimes(1)
    expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
    expect(mockGetVerifiedSubscriptionCharge).not.toHaveBeenCalled()
    expect(body.upgraded).toBeUndefined()
    expect(body.reauthorizeUpgrade).toBe(true)
    expect(body.immediateUpgrade).toBe(true)
  })
})
