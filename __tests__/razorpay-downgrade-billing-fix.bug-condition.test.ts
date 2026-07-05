/**
 * Bug Condition Exploration Test — Razorpay Downgrade Billing Fix
 *
 * Property 1: Bug Condition - Paid-to-Paid Downgrade Must Update Razorpay Plan
 *
 * This test encodes the EXPECTED behavior (what the code SHOULD do after the fix):
 * for any paid→paid downgrade (Pro→Starter, Agency→Pro, Agency→Starter), the
 * `/api/razorpay/downgrade` handler must call Razorpay's Update Subscription API
 * (PATCH https://api.razorpay.com/v1/subscriptions/:id) with the target tier's
 * plan_id and schedule_change_at: "cycle_end".
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code. A failure here CONFIRMS
 * the bug exists — the current /downgrade handler only ever calls Razorpay when
 * targetPlan === "free" (via cancelRazorpaySubscription); for any other paid→paid
 * target it silently writes `scheduled_downgrade` to Supabase and returns success
 * WITHOUT ever touching Razorpay's plan_id.
 *
 * DO NOT modify app/api/razorpay/downgrade/route.ts or lib/razorpay.ts to make
 * this test pass — this task only documents the bug. The fix comes in Task 7.
 *
 * Validates: Requirements 1.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock @/lib/api-auth so we control the authenticated user + their Supabase
// client without going through real cookies/JWT validation.
const mockAuthUser = { id: "user-123", email: "test@example.com" }
let mockCurrentSubRow: Record<string, unknown> | null = null

function makeSubscriptionsSelectChain() {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data: mockCurrentSubRow, error: null }))
  return chain
}

const mockAuthSupabase = {
  from: vi.fn((table: string) => {
    if (table === "subscriptions") return makeSubscriptionsSelectChain()
    const chain: any = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(async () => ({ data: null, error: null }))
    return chain
  }),
}

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(async () => ({
    user: mockAuthUser,
    supabase: mockAuthSupabase,
    error: null,
  })),
  validateOrigin: vi.fn(() => null),
}))

// Mock the service-role Supabase client (createClient from @supabase/supabase-js)
// used by the route for writes that bypass RLS (scheduled_downgrade write,
// cancellation, automation cleanup).
function makeUpdateChain() {
  const chain: any = {}
  chain.update = vi.fn(() => chain)
  chain.eq = vi.fn(async () => ({ error: null }))
  return chain
}

const mockSvcFrom = vi.fn(() => makeUpdateChain())

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockSvcFrom,
  })),
}))

// Mock secrets (used by cancelRazorpaySubscription / any future Razorpay
// update-subscription-plan helper to fetch API keys).
vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn(async (name: string) =>
    name === "RAZORPAY_KEY_ID" ? "rzp_test_key_id" : "rzp_test_key_secret"
  ),
}))

// Mock global fetch to record ALL outbound Razorpay HTTP calls (cancel, create,
// and — once implemented — the update-subscription-plan PATCH call).
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// ── Helpers ────────────────────────────────────────────────────────────────

function createDowngradeRequest(targetPlan: string): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/razorpay/downgrade"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({ targetPlan }),
  })
}

/** Fetch calls that hit Razorpay's Update Subscription endpoint (PATCH .../subscriptions/:id). */
function getSubscriptionUpdateCalls(subscriptionId: string) {
  return mockFetch.mock.calls.filter(([url, init]) => {
    const method = ((init?.method as string) || "GET").toUpperCase()
    return (
      typeof url === "string" &&
      url === `https://api.razorpay.com/v1/subscriptions/${subscriptionId}` &&
      method === "PATCH"
    )
  })
}

/** ANY fetch call to a subscription-CREATE endpoint (used only as a sanity check here). */
function getSubscriptionCreateCalls() {
  return mockFetch.mock.calls.filter(([url]) => url === "https://api.razorpay.com/v1/subscriptions")
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCurrentSubRow = null
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: "sub_MOCK", status: "active" }),
  })
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Bug Condition Exploration: Paid-to-Paid Downgrade Must Update Razorpay Plan", () => {
  const cases: Array<{ currentPlan: "pro" | "agency"; targetPlan: "starter" | "pro" }> = [
    { currentPlan: "pro", targetPlan: "starter" },
    { currentPlan: "agency", targetPlan: "pro" },
    { currentPlan: "agency", targetPlan: "starter" },
  ]

  it.each(cases)(
    "downgrade($currentPlan → $targetPlan) should call Razorpay's Update Subscription API with the target plan_id and schedule_change_at: 'cycle_end'",
    async ({ currentPlan, targetPlan }) => {
      const { getPlanIdForCurrency } = await import("@/lib/razorpay")
      const razorpaySubscriptionId = "sub_ABC123"

      mockCurrentSubRow = {
        user_id: mockAuthUser.id,
        plan: currentPlan,
        razorpay_subscription_id: razorpaySubscriptionId,
        currency: "INR",
        billing_cycle: "monthly",
        current_period_end: new Date(Date.now() + 15 * 86400 * 1000).toISOString(),
      }

      const { POST } = await import("@/app/api/razorpay/downgrade/route")
      const response = await POST(createDowngradeRequest(targetPlan))
      const body = await response.json()

      // Sanity: the request itself succeeds — scheduled_downgrade is written
      // to Supabase regardless of whether the Razorpay call happens.
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)

      const expectedPlanId = getPlanIdForCurrency(targetPlan, "INR", "monthly")
      const updateCalls = getSubscriptionUpdateCalls(razorpaySubscriptionId)

      // EXPECTED (post-fix) behavior: exactly one PATCH call to Razorpay's
      // Update Subscription API with the target tier's plan_id and
      // schedule_change_at: "cycle_end", and no subscription-CREATE call.
      expect(updateCalls.length).toBe(1)
      const [, init] = updateCalls[0]
      const sentBody = JSON.parse((init as RequestInit).body as string)
      expect(sentBody.plan_id).toBe(expectedPlanId)
      expect(sentBody.schedule_change_at).toBe("cycle_end")
      expect(getSubscriptionCreateCalls().length).toBe(0)
    }
  )
})
