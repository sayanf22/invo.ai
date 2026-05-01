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
        // The subscription has expired (current_period_end is in the past)
        const expiryDate = new Date(sub.current_period_end)
        expect(expiryDate.getTime()).toBeLessThan(Date.now())

        // resolveEffectiveTier checks current_period_end and returns "free" for expired subs
        const resolvedTier = resolveEffectiveTier(sub)
        expect(resolvedTier).toBe("free")
      }),
      { numRuns: 100 }
    )
  })
})
