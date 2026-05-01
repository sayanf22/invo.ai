/**
 * Property 2: Preservation — Active Subscriptions and No-Subscription Users Unchanged
 * Feature: subscription-expiry-enforcement (bugfix)
 *
 * These tests capture the baseline behavior that MUST be preserved after implementing
 * the subscription expiry fix. They run on the UNFIXED code and are expected to PASS.
 *
 * - Active subscriptions (current_period_end in the future) return their stored plan
 * - No-subscription users (null/undefined) default to "free"
 * - getTierLimits() returns correct limits for each tier
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  parseTier,
  getTierLimits,
  checkDocumentTypeAllowed,
  type UserTier,
} from "@/lib/cost-protection"

const PAID_TIERS = ["starter", "pro", "agency"] as const
const ALL_TIERS: UserTier[] = ["free", "starter", "pro", "agency"]

// Expected tier limits from the spec
const EXPECTED_LIMITS: Record<UserTier, {
  documentsPerMonth: number
  messagesPerSession: number
  emailsPerMonth: number
  allowedDocTypes: string[]
}> = {
  free: {
    documentsPerMonth: 5,
    messagesPerSession: 10,
    emailsPerMonth: 5,
    allowedDocTypes: ["invoice", "contract"],
  },
  starter: {
    documentsPerMonth: 50,
    messagesPerSession: 30,
    emailsPerMonth: 100,
    allowedDocTypes: ["invoice", "contract", "quotation", "proposal"],
  },
  pro: {
    documentsPerMonth: 150,
    messagesPerSession: 50,
    emailsPerMonth: 250,
    allowedDocTypes: ["invoice", "contract", "quotation", "proposal"],
  },
  agency: {
    documentsPerMonth: 0,
    messagesPerSession: 0,
    emailsPerMonth: 0,
    allowedDocTypes: ["invoice", "contract", "quotation", "proposal"],
  },
}

// Generator: future date (1 day to 2 years from now)
const futureDateArb = fc.integer({ min: 1, max: 730 }).map((daysAhead) => {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString()
})

// Generator: active subscription with a paid plan and future expiry
const activeSubscriptionArb = fc.record({
  plan: fc.constantFrom(...PAID_TIERS),
  status: fc.constant("active" as const),
  current_period_end: futureDateArb,
})

describe("Feature: subscription-expiry-enforcement, Property 2: Preservation — Active Subscriptions Unchanged", () => {
  // ── Preservation: parseTier returns stored plan for active subscriptions ──

  describe("parseTier preserves active subscription tiers", () => {
    it("SHALL return the stored plan value for any valid paid tier", () => {
      fc.assert(
        fc.property(
          activeSubscriptionArb,
          (sub) => {
            const result = parseTier(sub.plan)
            expect(result).toBe(sub.plan)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("SHALL return 'starter' for parseTier('starter')", () => {
      expect(parseTier("starter")).toBe("starter")
    })

    it("SHALL return 'pro' for parseTier('pro')", () => {
      expect(parseTier("pro")).toBe("pro")
    })

    it("SHALL return 'agency' for parseTier('agency')", () => {
      expect(parseTier("agency")).toBe("agency")
    })
  })

  // ── Preservation: no-subscription users default to free ──

  describe("No-subscription users default to free tier", () => {
    it("SHALL return 'free' for parseTier(undefined)", () => {
      expect(parseTier(undefined)).toBe("free")
    })

    it("SHALL return 'free' for parseTier(null)", () => {
      expect(parseTier(null)).toBe("free")
    })

    it("SHALL return 'free' for any non-string or invalid tier value", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(undefined),
            fc.constant(null),
            fc.constant(""),
            fc.constant("invalid"),
            fc.constant("premium"),
            fc.integer(),
            fc.boolean(),
          ),
          (value) => {
            const result = parseTier(value)
            expect(result).toBe("free")
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  // ── Preservation: getTierLimits returns correct limits for each tier ──

  describe("getTierLimits returns correct limits for all tiers", () => {
    it("SHALL return correct documentsPerMonth for any tier", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_TIERS),
          (tier) => {
            const limits = getTierLimits(tier)
            expect(limits.documentsPerMonth).toBe(EXPECTED_LIMITS[tier].documentsPerMonth)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("SHALL return correct messagesPerSession for any tier", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_TIERS),
          (tier) => {
            const limits = getTierLimits(tier)
            expect(limits.messagesPerSession).toBe(EXPECTED_LIMITS[tier].messagesPerSession)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("SHALL return correct emailsPerMonth for any tier", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_TIERS),
          (tier) => {
            const limits = getTierLimits(tier)
            expect(limits.emailsPerMonth).toBe(EXPECTED_LIMITS[tier].emailsPerMonth)
          }
        ),
        { numRuns: 50 }
      )
    })

    it("SHALL return correct allowedDocTypes for any tier", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_TIERS),
          (tier) => {
            const limits = getTierLimits(tier)
            expect(limits.allowedDocTypes).toEqual(EXPECTED_LIMITS[tier].allowedDocTypes)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  // ── Preservation: document type restrictions match tier ──

  describe("Document type restrictions preserved per tier", () => {
    it("SHALL allow all 4 doc types for paid tiers", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PAID_TIERS),
          fc.constantFrom("invoice", "contract", "quotation", "proposal"),
          (tier, docType) => {
            const result = checkDocumentTypeAllowed(docType, tier)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 50 }
      )
    })

    it("SHALL allow invoice and contract for free tier", () => {
      expect(checkDocumentTypeAllowed("invoice", "free")).toBeNull()
      expect(checkDocumentTypeAllowed("contract", "free")).toBeNull()
    })

    it("SHALL block quotation and proposal for free tier", () => {
      const quotResult = checkDocumentTypeAllowed("quotation", "free")
      expect(quotResult).not.toBeNull()
      expect(quotResult!.status).toBe(403)

      const propResult = checkDocumentTypeAllowed("proposal", "free")
      expect(propResult).not.toBeNull()
      expect(propResult!.status).toBe(403)
    })
  })
})
