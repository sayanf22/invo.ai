/**
 * Preservation Property Tests — create-order Upgrade Path (Task 6)
 *
 * Bugfix spec: razorpay-downgrade-billing-fix
 *
 * Property 6: Preservation — Free-to-Paid Signups and Non-Updatable-State
 * Fallback Unaffected.
 *
 * These tests capture BASELINE behavior of `POST /api/razorpay/create-order`
 * on UNFIXED code, following observation-first methodology. They MUST pass
 * on unfixed code — they document behavior that must be preserved once the
 * fix (tasks 7.6-7.9) adds the existing-subscription lookup + Razorpay
 * Update Subscription branch for updatable-state paid upgrades.
 *
 * Observed on UNFIXED code:
 *  - A user with NO existing `subscriptions` row (or no
 *    `razorpay_subscription_id`) calling `create-order` for any paid plan
 *    calls `createRazorpaySubscription()` and returns the existing
 *    `{ subscriptionId, keyId, plan, ... }` Checkout response shape.
 *  - A user WITH an existing `razorpay_subscription_id` whose Razorpay-side
 *    status is `created` / `pending` / `halted` ALSO calls
 *    `createRazorpaySubscription()` and returns the same response shape —
 *    because unfixed code has NO status branching at all, it always
 *    creates, regardless of the existing subscription's state.
 *
 * NOTE: on unfixed code `createRazorpaySubscription()` is in fact called
 * for EVERY input (including the buggy updatable-state upgrade case
 * captured separately by task 5's exploration test), since the route has no
 * existing-subscription check whatsoever. This test scopes its generator
 * and assertions to the PRESERVATION-relevant subset only — free→paid
 * signups and non-updatable-state fallbacks — per the task description,
 * even though the same assertions would trivially pass for the bug-condition
 * subset too on today's unfixed code.
 *
 * Validates: Requirements 2.3, 2.4, 3.9
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import fc from "fast-check"

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(),
  validateOrigin: vi.fn().mockReturnValue(null),
}))

const mockCreateRazorpaySubscription = vi.fn()
const mockGetSubscription = vi.fn()
const mockGetSubscriptionInvoices = vi.fn()
const mockUpdateRazorpaySubscriptionPlan = vi.fn()
const mockGetPlanIdForCurrency = vi.fn()
const mockPlanIdToPlan = vi.fn().mockReturnValue(null)
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
  updateRazorpaySubscriptionPlan: mockUpdateRazorpaySubscriptionPlan,
  getPlanIdForCurrency: mockGetPlanIdForCurrency,
  planIdToPlan: mockPlanIdToPlan,
  RazorpayApiError: MockRazorpayApiError,
}))

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("mock-key-id"),
}))

const mockSvcFrom = vi.fn()
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
 * Mocks a Supabase client. The `subscriptions` table read returns either:
 *  - `null` (no row) when `hasExistingSubscription` is false — the
 *    free→paid signup case, or
 *  - a row with `razorpay_subscription_id: sub_ABC` when true — the
 *    existing-subscription case (used together with a `getSubscription()`
 *    mock reporting a non-updatable status for the fallback case).
 *
 * The unfixed route never queries this table at all, so wiring it up here
 * has no effect on unfixed behavior — it exists so the SAME test exercises
 * the real lookup once the fix (task 7.6) lands.
 */
function buildSupabaseMock(hasExistingSubscription: boolean, currentPlan: string) {
  const row = hasExistingSubscription
    ? {
        plan: currentPlan,
        razorpay_subscription_id: EXISTING_SUBSCRIPTION_ID,
        currency: "INR",
        billing_cycle: "monthly",
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }
    : null
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

const CHECKOUT_RESPONSE_KEYS = ["subscriptionId", "keyId", "plan", "billingCycle", "planName", "currency", "amount"]

// ── Tests ──────────────────────────────────────────────────────────────

describe("Preservation Property Tests: create-order upgrade path (unfixed baseline)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateRazorpaySubscription.mockResolvedValue({ id: "sub_BRAND_NEW_XYZ" })
    mockGetSubscription.mockResolvedValue({
      id: EXISTING_SUBSCRIPTION_ID,
      status: "created",
      plan_id: "plan_current_old",
    })
    mockGetPlanIdForCurrency.mockReturnValue("plan_target_new")
    mockUpdateRazorpaySubscriptionPlan.mockResolvedValue({
      id: EXISTING_SUBSCRIPTION_ID,
      status: "active",
    })
    mockResolveSubscriptionCurrency.mockReturnValue("INR")
    mockGetSubscriptionInvoices.mockResolvedValue([])
    mockSvcFrom.mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
      if (table === "payment_history") {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }
    })
  })

  // ── Example-based observations ───────────────────────────────────────

  it("observation: free→paid signup (no subscriptions row) calls createRazorpaySubscription() and returns the Checkout response shape", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMock(false, "free") as any,
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "starter", billingCycle: "monthly" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockCreateRazorpaySubscription).toHaveBeenCalledTimes(1)
    expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
    for (const key of CHECKOUT_RESPONSE_KEYS) {
      expect(body).toHaveProperty(key)
    }
  })

  it("observation: existing subscription in non-updatable state (created/pending/halted) ALSO calls createRazorpaySubscription() and returns the same response shape", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMock(true, "pro") as any,
    })
    mockGetSubscription.mockResolvedValue({
      id: EXISTING_SUBSCRIPTION_ID,
      status: "halted",
      plan_id: "plan_current_old",
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "agency", billingCycle: "monthly" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockCreateRazorpaySubscription).toHaveBeenCalledTimes(1)
    expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
    for (const key of CHECKOUT_RESPONSE_KEYS) {
      expect(body).toHaveProperty(key)
    }
  })

  it("rejects a downgrade routed through create-order without creating a second mandate", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: buildSupabaseMock(true, "agency") as any,
    })
    mockGetSubscription.mockResolvedValue({
      id: EXISTING_SUBSCRIPTION_ID,
      status: "active",
      plan_id: "plan_current_old",
    })

    const { POST } = await import("@/app/api/razorpay/create-order/route")
    const response = await POST(makeRequest({ plan: "starter", billingCycle: "monthly" }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe("DOWNGRADE_REQUIRED")
    expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
    expect(mockCreateRazorpaySubscription).not.toHaveBeenCalled()
  })

  // ── Property 6: Preservation (generative) ────────────────────────────

  /**
   * For random (hasExistingSubscription, razorpayStatus, currentPlan,
   * targetPlan) combinations, SCOPED to the preservation-relevant subset
   * (free→paid signups OR non-updatable-state existing subscriptions —
   * i.e. NOT the bug-condition subset covered separately by task 5):
   *  - `createRazorpaySubscription()` is called exactly once
   *  - `updateRazorpaySubscriptionPlan()` is NEVER called
   *  - the response is the existing Checkout response shape
   *
   * Validates: Requirements 2.3, 2.4, 3.9
   */
  it("Property 6: createRazorpaySubscription() called + Checkout shape returned for free→paid and non-updatable-state cases", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .record({
            hasExistingSubscription: fc.boolean(),
            razorpayStatus: fc.constantFrom("created", "pending", "halted", "authenticated", "active"),
            currentPlan: fc.constantFrom("free", "starter", "pro", "agency"),
            targetPlan: fc.constantFrom("starter", "pro", "agency"),
          })
          // Scope to the PRESERVATION subset per the task description, PLUS
          // the downgrade-direction guard case: free→paid signups (no
          // existing subscription), OR an existing subscription whose
          // Razorpay-side status is non-updatable, OR an existing
          // updatable-state subscription where targetPlan is a DOWNGRADE
          // (not an upgrade) — none of these should ever call the immediate
          // Update Subscription API.
          .filter(({ hasExistingSubscription, razorpayStatus, currentPlan, targetPlan }) => {
            if (!hasExistingSubscription) return true
            if (["created", "pending", "halted"].includes(razorpayStatus)) return true
            const order = ["free", "starter", "pro", "agency"]
            return order.indexOf(targetPlan) <= order.indexOf(currentPlan)
          }),
        async ({ hasExistingSubscription, razorpayStatus, currentPlan, targetPlan }) => {
          vi.clearAllMocks()
          mockCreateRazorpaySubscription.mockResolvedValue({ id: "sub_BRAND_NEW_XYZ" })
          mockGetSubscription.mockResolvedValue({
            id: EXISTING_SUBSCRIPTION_ID,
            status: razorpayStatus,
            plan_id: "plan_current_old",
          })
          mockGetPlanIdForCurrency.mockReturnValue("plan_target_new")
          mockResolveSubscriptionCurrency.mockReturnValue("INR")
          mockGetSubscriptionInvoices.mockResolvedValue([])
          mockSvcFrom.mockImplementation((table: string) => {
            if (table === "subscriptions") {
              return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
            }
            if (table === "payment_history") {
              return {
                select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
                insert: vi.fn().mockResolvedValue({ error: null }),
              }
            }
            return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }
          })

          vi.mocked(authenticateRequest).mockResolvedValue({
            error: null,
            user: mockUser as any,
            supabase: buildSupabaseMock(hasExistingSubscription, currentPlan) as any,
          })

          const { POST } = await import("@/app/api/razorpay/create-order/route")
          const response = await POST(makeRequest({ plan: targetPlan, billingCycle: "monthly" }))
          const body = await response.json()

          const currentIdx = ["free", "starter", "pro", "agency"].indexOf(currentPlan)
          const targetIdx = ["free", "starter", "pro", "agency"].indexOf(targetPlan)
          const mustRejectDirection = hasExistingSubscription && currentPlan !== "free" && targetIdx <= currentIdx

          if (mustRejectDirection) {
            expect(response.status).toBe(409)
            expect(body.code).toBe(targetIdx === currentIdx ? "SAME_PLAN" : "DOWNGRADE_REQUIRED")
            expect(mockCreateRazorpaySubscription).not.toHaveBeenCalled()
          } else {
            expect(response.status).toBe(200)
            expect(mockCreateRazorpaySubscription).toHaveBeenCalledTimes(1)
            for (const key of CHECKOUT_RESPONSE_KEYS) expect(body).toHaveProperty(key)
            expect(body.plan).toBe(targetPlan)
          }
          expect(mockUpdateRazorpaySubscriptionPlan).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 50 }
    )
  })
})
