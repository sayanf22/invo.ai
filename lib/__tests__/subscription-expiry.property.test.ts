/**
 * Property 1: Fix Verification — Expired Subscriptions Now Resolve to Free Tier
 * Feature: subscription-expiry-enforcement
 *
 * For any subscription where plan is in {starter, pro, agency} AND
 * current_period_end is in the past, resolveEffectiveTier() SHOULD return "free".
 *
 * Now that resolveEffectiveTier() checks current_period_end before returning
 * the tier, this test should PASS — confirming the bug is fixed.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { resolveEffectiveTier } from "@/lib/cost-protection"

// Paid plans that should downgrade to "free" when expired
const PAID_PLANS = ["starter", "pro", "agency"] as const

// Generate a past date (1 hour to 365 days in the past)
const pastDateArb = fc
  .integer({ min: 1, max: 365 * 24 })
  .map((hoursAgo) => {
    const d = new Date()
    d.setHours(d.getHours() - hoursAgo)
    return d.toISOString()
  })

// Generate a random expired subscription record
const expiredSubscriptionArb = fc.record({
  plan: fc.constantFrom(...PAID_PLANS),
  status: fc.constantFrom("active", "cancelled", "expired"),
  current_period_end: pastDateArb,
})

describe("Feature: subscription-expiry-enforcement, Property 1: Fix Verification — Expired Subscriptions Resolve to Free Tier", () => {
  it("resolveEffectiveTier() returns 'free' for expired subscriptions", () => {
    fc.assert(
      fc.property(expiredSubscriptionArb, (sub) => {
        const expiryDate = new Date(sub.current_period_end)
        expect(expiryDate.getTime()).toBeLessThan(Date.now())
        expect(resolveEffectiveTier(sub)).toBe("free")
      }),
      { numRuns: 100 }
    )
  })

  it("keeps paid access through a future period end regardless of early cancellation or payment-failure status", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PAID_PLANS),
        fc.constantFrom("active", "trialing", "cancelled", "past_due", "paused"),
        fc.integer({ min: 60_000, max: 365 * 24 * 60 * 60 * 1000 }),
        (plan, status, millisecondsAhead) => {
          expect(resolveEffectiveTier({
            plan,
            status,
            current_period_end: new Date(Date.now() + millisecondsAhead).toISOString(),
          })).toBe(plan)
        },
      ),
      { numRuns: 100 },
    )
  })

  it("expires at the exact UTC period boundary", () => {
    expect(resolveEffectiveTier({
      plan: "pro",
      status: "active",
      current_period_end: new Date(Date.now() - 1).toISOString(),
    })).toBe("free")
  })
})
