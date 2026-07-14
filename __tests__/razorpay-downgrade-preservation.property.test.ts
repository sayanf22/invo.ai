/**
 * Preservation Property Tests — Razorpay Downgrade Route (Task 2)
 *
 * Bugfix spec: razorpay-downgrade-billing-fix
 *
 * These tests capture BASELINE behavior of `POST /api/razorpay/downgrade` on
 * UNFIXED code, following observation-first methodology. They MUST pass on
 * unfixed code — they document behavior that must be preserved once the fix
 * (task 7) adds the missing Razorpay "update subscription plan" call for
 * paid→paid downgrades.
 *
 * Observed on UNFIXED code:
 *  - Downgrade-to-free (`targetPlan: "free"`) calls
 *    `cancelRazorpaySubscription(currentSub.razorpay_subscription_id, true)`
 *    and disables `recurring_invoices` / `email_schedules`, and makes NO call
 *    to any Razorpay subscription-plan-update endpoint.
 *  - An upgrade/same-plan request (`targetIdx >= currentIdx`) returns 400
 *    `{ error: "This is not a downgrade" }` without touching Razorpay or
 *    writing to Supabase.
 *  - A user with no `subscriptions` row returns 400
 *    `{ error: "No active subscription" }`.
 *  - A paid→paid downgrade (e.g. Pro→Starter) writes `scheduled_downgrade`
 *    but — on unfixed code — makes NO Razorpay call at all (this is the bug,
 *    captured separately by task 1's exploration test; here we only assert
 *    the "no plan-update call happens for ANY input today" baseline, which
 *    is trivially consistent with "plan-update call ⟺ isBugCondition(X)"
 *    since, on unfixed code, the left side is always false).
 *
 * Property 2: Preservation — Downgrade-to-Free and Non-Downgrade Paths
 * Unaffected.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import fc from "fast-check"

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock next/headers cookies — provides a valid Supabase auth-token cookie so
// authenticateRequest() resolves a user via the mocked supabase auth client.
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [
      {
        name: "sb-test-auth-token",
        value: JSON.stringify({ access_token: "mock-token" }),
      },
    ],
  }),
}))

vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn(() => null),
}))

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(() => null),
}))

// Shared mutable test state, reconfigured per test/property-run via setupState().
interface TestState {
  subscriptionRow: Record<string, any> | null
  scheduledDowngradeUpdates: Array<{ patch: any; userId: string }>
  cancelledAtUpdates: Array<{ patch: any; userId: string }>
  automationUpdates: Array<{ table: string; patch: any }>
  failConfirmationUpdate: boolean
}

let state: TestState

function freshState(): TestState {
  return {
    subscriptionRow: null,
    scheduledDowngradeUpdates: [],
    cancelledAtUpdates: [],
    automationUpdates: [],
    failConfirmationUpdate: false,
  }
}

const mockSupabaseAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  }),
}

const mockFrom = vi.fn((table: string) => {
  if (table === "profiles") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { suspended_at: null }, error: null })),
        })),
      })),
    }
  }

  if (table === "subscriptions") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: state.subscriptionRow,
            error: state.subscriptionRow ? null : null,
          })),
        })),
      })),
      update: vi.fn((patch: any) => {
        let userId = ""
        let recorded = false
        const result = () => {
          if (state.failConfirmationUpdate && patch.provider_sync_required === false && !("scheduled_downgrade" in patch)) {
            return { data: null, error: { message: "database unavailable" } }
          }
          return { data: { user_id: userId }, error: null }
        }
        const query: any = {
          eq: vi.fn((_col: string, value: string) => {
            userId = value
            if (!recorded) {
              if ("scheduled_downgrade" in patch) state.scheduledDowngradeUpdates.push({ patch, userId })
              if ("cancelled_at" in patch) state.cancelledAtUpdates.push({ patch, userId })
              recorded = true
            }
            return query
          }),
          is: vi.fn(() => query),
          select: vi.fn(() => query),
          maybeSingle: vi.fn(async () => result()),
          then: (resolve: (value: any) => unknown) => Promise.resolve(resolve(result())),
        }
        return query
      }),
    }
  }

  if (table === "recurring_invoices" || table === "email_schedules") {
    return {
      update: vi.fn((patch: any) => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => {
            state.automationUpdates.push({ table, patch })
            return { error: null }
          }),
        })),
      })),
    }
  }

  // Default no-op fallback for any other table
  return {
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  }
})

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: mockSupabaseAuth,
    from: mockFrom,
  })),
}))

// Partially mock @/lib/razorpay — keep the real PLANS / getPlanIdForCurrency
// etc, but replace cancelRazorpaySubscription with a spy so we can assert
// exactly when it is (and isn't) called.
const mockCancelRazorpaySubscription = vi.fn(async (subscriptionId: string) => ({
  id: subscriptionId,
  status: "cancelled",
}))
const mockUpdateRazorpaySubscriptionPlan = vi.fn(async (subscriptionId: string, planId: string) => ({
  id: subscriptionId,
  status: "active",
  plan_id: planId,
}))

vi.mock("@/lib/razorpay", async () => {
  const actual = await vi.importActual<typeof import("@/lib/razorpay")>("@/lib/razorpay")
  return {
    ...actual,
    cancelRazorpaySubscription: mockCancelRazorpaySubscription,
    updateRazorpaySubscriptionPlan: mockUpdateRazorpaySubscriptionPlan,
  }
})

// Spy on global fetch — on unfixed code, NOTHING in the downgrade route ever
// calls fetch directly (cancelRazorpaySubscription is fully mocked above),
// so any Razorpay "update subscription plan" call would show up here as a
// call that unfixed code never makes.
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/razorpay/downgrade", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // validateOrigin requires Origin/Referer for state-changing requests;
      // localhost is allowed outside production.
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  })
}

const PLAN_ORDER = ["free", "starter", "pro", "agency"] as const
type Plan = (typeof PLAN_ORDER)[number]

function planIdx(plan: Plan): number {
  return PLAN_ORDER.indexOf(plan)
}

/** isBugCondition(X) per design.md's Glossary/Bug Details section. */
function isBugCondition(currentPlan: Plan, targetPlan: Plan, hasExistingRazorpaySubscription: boolean): boolean {
  const paidTiers: Plan[] = ["starter", "pro", "agency"]
  return (
    paidTiers.includes(currentPlan) &&
    paidTiers.includes(targetPlan) &&
    planIdx(targetPlan) < planIdx(currentPlan) &&
    hasExistingRazorpaySubscription
  )
}

function setupSubscription(currentPlan: Plan | null) {
  state.subscriptionRow = currentPlan
    ? {
        user_id: "user-123",
        plan: currentPlan,
        razorpay_subscription_id: "sub_ABC123",
        currency: "INR",
        billing_cycle: "monthly",
        current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      }
    : null
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Preservation Property Tests: /api/razorpay/downgrade (unfixed baseline)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state = freshState()
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    })
  })

  // ── Example-based observations (from task description) ─────────────────

  it("downgrade-to-free cancels at cycle end and preserves paid automations until entitlement ends", async () => {
    const { POST } = await import("@/app/api/razorpay/downgrade/route")

    setupSubscription("pro")

    const res = await POST(createMockRequest({ targetPlan: "free" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    expect(mockCancelRazorpaySubscription).toHaveBeenCalledTimes(1)
    expect(mockCancelRazorpaySubscription).toHaveBeenCalledWith("sub_ABC123", true)

    expect(state.scheduledDowngradeUpdates).toHaveLength(1)
    expect(state.scheduledDowngradeUpdates[0].patch.scheduled_downgrade).toBe("free")
    expect(state.cancelledAtUpdates).toHaveLength(1)

    // Paid features and automations remain available for the period already paid.
    // The terminal cancellation webhook disables them when access actually ends.
    expect(state.automationUpdates).toHaveLength(0)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("observation: upgrade request returns 400 'This is not a downgrade' without touching Razorpay or Supabase writes", async () => {
    const { POST } = await import("@/app/api/razorpay/downgrade/route")

    setupSubscription("starter")

    const res = await POST(createMockRequest({ targetPlan: "pro" }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("This is not a downgrade")

    expect(mockCancelRazorpaySubscription).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(state.scheduledDowngradeUpdates).toHaveLength(0)
    expect(state.cancelledAtUpdates).toHaveLength(0)
    expect(state.automationUpdates).toHaveLength(0)
  })

  it("observation: no subscription row returns 400 'No active subscription'", async () => {
    const { POST } = await import("@/app/api/razorpay/downgrade/route")

    setupSubscription(null)

    const res = await POST(createMockRequest({ targetPlan: "free" }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("No active subscription")

    expect(mockCancelRazorpaySubscription).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(state.scheduledDowngradeUpdates).toHaveLength(0)
  })

  it("rolls back the local schedule and returns a retryable error when provider scheduling fails", async () => {
    setupSubscription("pro")
    mockUpdateRazorpaySubscriptionPlan.mockRejectedValueOnce(new Error("provider unavailable"))

    const { POST } = await import("@/app/api/razorpay/downgrade/route")
    const res = await POST(createMockRequest({ targetPlan: "starter" }))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toContain("current plan is unchanged")
    expect(state.scheduledDowngradeUpdates).toHaveLength(2)
    expect(state.scheduledDowngradeUpdates[0].patch.scheduled_downgrade).toBe("starter")
    expect(state.scheduledDowngradeUpdates[1].patch.scheduled_downgrade).toBeNull()
  })

  it("returns truthful sync-pending success when provider cancellation succeeds but local confirmation fails", async () => {
    setupSubscription("pro")
    state.failConfirmationUpdate = true

    const { POST } = await import("@/app/api/razorpay/downgrade/route")
    const res = await POST(createMockRequest({ targetPlan: "free" }))
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.success).toBe(true)
    expect(body.syncPending).toBe(true)
    expect(body.message).toContain("Provider confirmation succeeded")
    expect(mockCancelRazorpaySubscription).toHaveBeenCalledWith("sub_ABC123", true)
    expect(state.scheduledDowngradeUpdates).toHaveLength(1)
  })

  // ── Property 2: Preservation (generative) ───────────────────────────────

  /**
   * For random (hasSubscription, currentPlan, targetPlan) combinations across
   * the endpoint's valid input space:
   *  - a Razorpay plan-update call happens iff isBugCondition(X) holds — on
   *    unfixed code this is vacuously true, since neither side ever occurs
   *    (no such call exists at all yet; captured as a bug separately by
   *    task 1's exploration test)
   *  - cancelRazorpaySubscription is called iff it's a valid downgrade to "free"
   *  - upgrades/same-plan always return the "not a downgrade" 400
   *  - missing-subscription always returns the "no active subscription" 400
   *
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  it("Property 2: plan-update ⟺ isBugCondition, cancel ⟺ valid downgrade-to-free, upgrades/same-plan rejected, missing-subscription rejected", async () => {
    const { POST } = await import("@/app/api/razorpay/downgrade/route")

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasSubscription: fc.boolean(),
          currentPlan: fc.constantFrom<Plan>("free", "starter", "pro", "agency"),
          // "agency" is not a valid downgrade *target* for this endpoint
          // (it's the top tier) — the route itself rejects it with
          // "Invalid target plan" before ever reaching the downgrade logic,
          // so we scope the generator to the endpoint's valid input space.
          targetPlan: fc.constantFrom<Plan>("free", "starter", "pro"),
        }),
        async ({ hasSubscription, currentPlan, targetPlan }) => {
          vi.clearAllMocks()
          state = freshState()
          mockSupabaseAuth.getUser.mockResolvedValue({
            data: { user: { id: "user-123", email: "test@example.com" } },
            error: null,
          })

          setupSubscription(hasSubscription ? currentPlan : null)

          const res = await POST(createMockRequest({ targetPlan }))
          const body = await res.json()

          const bugCondition = isBugCondition(currentPlan, targetPlan, hasSubscription)
          expect(mockUpdateRazorpaySubscriptionPlan.mock.calls.length > 0).toBe(bugCondition)

          if (!hasSubscription) {
            expect(res.status).toBe(400)
            expect(body.error).toBe("No active subscription")
            expect(mockCancelRazorpaySubscription).not.toHaveBeenCalled()
            return
          }

          if (currentPlan === "free") {
            expect(res.status).toBe(400)
            expect(body.error).toBe("No active paid subscription")
            expect(mockCancelRazorpaySubscription).not.toHaveBeenCalled()
            return
          }

          const currentIdx = planIdx(currentPlan)
          const targetIdx = planIdx(targetPlan)
          const isValidDowngrade = targetIdx < currentIdx

          if (!isValidDowngrade) {
            // Upgrade or same-plan request
            expect(res.status).toBe(400)
            expect(body.error).toBe("This is not a downgrade")
            expect(mockCancelRazorpaySubscription).not.toHaveBeenCalled()
            expect(state.scheduledDowngradeUpdates).toHaveLength(0)
            return
          }

          // Valid downgrade (targetPlan lower than currentPlan)
          expect(res.status).toBe(200)
          expect(body.success).toBe(true)
          expect(state.scheduledDowngradeUpdates).toHaveLength(1)
          expect(state.scheduledDowngradeUpdates[0].patch.scheduled_downgrade).toBe(targetPlan)

          if (targetPlan === "free") {
            expect(mockCancelRazorpaySubscription).toHaveBeenCalledTimes(1)
            expect(mockCancelRazorpaySubscription).toHaveBeenCalledWith("sub_ABC123", true)
            expect(state.cancelledAtUpdates).toHaveLength(1)
          } else {
            expect(mockCancelRazorpaySubscription).not.toHaveBeenCalled()
            expect(mockUpdateRazorpaySubscriptionPlan).toHaveBeenCalledTimes(1)
            expect(mockUpdateRazorpaySubscriptionPlan).toHaveBeenCalledWith(
              "sub_ABC123",
              expect.any(String),
              "cycle_end",
            )
            expect(state.cancelledAtUpdates).toHaveLength(0)
            expect(state.automationUpdates).toHaveLength(0)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
