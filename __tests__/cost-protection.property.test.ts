/**
 * Property-based tests for cost-protection tier access control.
 *
 * This file covers Property 3: Tier access control enforcement.
 *
 * For any (documentType, userTier) pair, `checkDocumentTypeAllowed` returns
 * null when:
 *   (a) the type normalizes to "invoice" (invoice-always-accessible invariant), OR
 *   (b) the type is in that tier's allowedDocTypes.
 * For all other cases it returns a 403 response.
 * The invoice invariant takes precedence over the allowedDocTypes lookup.
 *
 * **Validates: Requirements 2.1, 2.2**
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { checkDocumentTypeAllowed, type UserTier } from "@/lib/cost-protection"
import { ALL_DOCUMENT_TYPES, normalizeDocumentType } from "@/lib/document-type-registry"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TIERS: UserTier[] = ["free", "starter", "pro", "agency"]

/** Types the free tier allows (excluding invoice, which is covered by the invariant). */
const FREE_TIER_ALLOWED = ["invoice", "contract", "quote"] as const

/** Types the free tier blocks (all types not in FREE_TIER_ALLOWED). */
const FREE_TIER_BLOCKED = ALL_DOCUMENT_TYPES.filter(
  (t) => !(FREE_TIER_ALLOWED as readonly string[]).includes(t)
)

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const anyDocumentType = fc.constantFrom(...ALL_DOCUMENT_TYPES)
const anyTier = fc.constantFrom<UserTier>("free", "starter", "pro", "agency")

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Oracle: returns true iff checkDocumentTypeAllowed should return null (allowed)
 * for the given (docType, tier) pair.
 *
 * Mirrors the logic in cost-protection.ts independently so the property test
 * is not just re-running the implementation.
 */
function shouldBeAllowed(docType: string, tier: UserTier): boolean {
  const normalized = normalizeDocumentType(docType) ?? docType.toLowerCase()
  // Invoice invariant — always allowed regardless of tier
  if (normalized === "invoice") return true
  // Free tier only allows invoice, contract, quote
  if (tier === "free") {
    return (FREE_TIER_ALLOWED as readonly string[]).includes(normalized)
  }
  // Paid tiers (starter, pro, agency) allow all document types
  return (ALL_DOCUMENT_TYPES as readonly string[]).includes(normalized)
}

// ─── Property 3: Tier access control enforcement ──────────────────────────────

describe("Property 3: Tier access control enforcement", () => {
  // ─── Invoice Invariant ──────────────────────────────────────────────────────

  describe("invoice invariant", () => {
    /**
     * For ALL tiers, checkDocumentTypeAllowed("invoice", tier) must return null.
     * This holds independent of tier — invoice is always accessible.
     *
     * **Validates: Requirement 2.1**
     */
    it("invoice is always allowed regardless of tier (property-based)", () => {
      fc.assert(
        fc.property(anyTier, (tier) => {
          const result = checkDocumentTypeAllowed("invoice", tier)
          expect(result).toBeNull()
        }),
        { numRuns: 100 }
      )
    })

    it.each(ALL_TIERS)(
      "invoice is allowed on tier: %s",
      (tier) => {
        expect(checkDocumentTypeAllowed("invoice", tier)).toBeNull()
      }
    )
  })

  // ─── Legacy Alias: quotation → quote ───────────────────────────────────────

  describe("legacy alias: quotation normalizes to quote", () => {
    /**
     * "quotation" normalizes to "quote", which is in the free tier allowedDocTypes.
     * So checkDocumentTypeAllowed("quotation", "free") must return null.
     *
     * **Validates: Requirement 2.2**
     */
    it("quotation is allowed on free tier (normalizes to quote)", () => {
      expect(checkDocumentTypeAllowed("quotation", "free")).toBeNull()
    })

    it.each(ALL_TIERS)(
      "quotation is allowed on tier: %s",
      (tier) => {
        // "quotation" normalizes to "quote", which is allowed on all tiers
        expect(checkDocumentTypeAllowed("quotation", tier)).toBeNull()
      }
    )
  })

  // ─── Free Tier: Allowed Types ───────────────────────────────────────────────

  describe("free tier allowed types", () => {
    /**
     * For types in ["invoice", "contract", "quote"], checkDocumentTypeAllowed
     * must return null on the free tier.
     *
     * **Validates: Requirement 2.2**
     */
    it.each(Array.from(FREE_TIER_ALLOWED))(
      "%s is allowed on free tier",
      (docType) => {
        expect(checkDocumentTypeAllowed(docType, "free")).toBeNull()
      }
    )
  })

  // ─── Free Tier: Blocked Types ───────────────────────────────────────────────

  describe("free tier blocked types", () => {
    /**
     * For types not in the free tier allowedDocTypes, checkDocumentTypeAllowed
     * must return a non-null response (status 403).
     *
     * **Validates: Requirement 2.2**
     */
    it.each(FREE_TIER_BLOCKED)(
      "%s is blocked (403) on free tier",
      (docType) => {
        const result = checkDocumentTypeAllowed(docType, "free")
        expect(result).not.toBeNull()
        expect(result?.status).toBe(403)
      }
    )
  })

  // ─── Paid Tiers: All Types Allowed ─────────────────────────────────────────

  describe("paid tiers allow all document types", () => {
    /**
     * For starter, pro, and agency tiers, all types in ALL_DOCUMENT_TYPES
     * must return null.
     *
     * **Validates: Requirement 2.2**
     */
    it("starter tier allows all document types (property-based)", () => {
      fc.assert(
        fc.property(anyDocumentType, (docType) => {
          expect(checkDocumentTypeAllowed(docType, "starter")).toBeNull()
        }),
        { numRuns: 100 }
      )
    })

    it("pro tier allows all document types (property-based)", () => {
      fc.assert(
        fc.property(anyDocumentType, (docType) => {
          expect(checkDocumentTypeAllowed(docType, "pro")).toBeNull()
        }),
        { numRuns: 100 }
      )
    })

    it("agency tier allows all document types (property-based)", () => {
      fc.assert(
        fc.property(anyDocumentType, (docType) => {
          expect(checkDocumentTypeAllowed(docType, "agency")).toBeNull()
        }),
        { numRuns: 100 }
      )
    })

    it.each(
      (["starter", "pro", "agency"] as UserTier[]).flatMap((tier) =>
        ALL_DOCUMENT_TYPES.map((docType) => [tier, docType] as [UserTier, string])
      )
    )("tier %s allows %s", (tier, docType) => {
      expect(checkDocumentTypeAllowed(docType, tier)).toBeNull()
    })
  })

  // ─── Core Property: null iff invoice invariant OR in allowed set ────────────

  describe("core property: result is null iff allowed by oracle", () => {
    /**
     * For any (documentType, userTier) pair drawn from the canonical sets,
     * checkDocumentTypeAllowed returns null iff the oracle says it should.
     *
     * Oracle: null when (normalized === "invoice") OR (type in tier's allowed set).
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it("result is null iff (invoice invariant OR type is in tier allowed set)", () => {
      fc.assert(
        fc.property(anyDocumentType, anyTier, (docType, tier) => {
          const result = checkDocumentTypeAllowed(docType, tier)
          const allowed = shouldBeAllowed(docType, tier)

          if (allowed) {
            expect(result).toBeNull()
          } else {
            expect(result).not.toBeNull()
            expect(result?.status).toBe(403)
          }
        }),
        { numRuns: 500 }
      )
    })

    /**
     * Invoice invariant always takes precedence: even if the invoice type were
     * accidentally removed from a tier's allowedDocTypes, it must still be allowed.
     *
     * We verify this by checking "invoice" returns null across all tiers
     * together with a non-invoice type that free tier blocks, confirming
     * the invariant is the deciding factor for free tier + invoice.
     *
     * **Validates: Requirement 2.1**
     */
    it("invoice invariant takes precedence — invoice is null, proposal is blocked on free", () => {
      expect(checkDocumentTypeAllowed("invoice", "free")).toBeNull()
      expect(checkDocumentTypeAllowed("proposal", "free")).not.toBeNull()
    })
  })

  // ─── 403 Response Shape ─────────────────────────────────────────────────────

  describe("blocked response shape", () => {
    /**
     * When blocked, the response must have status 403 (not 429 or anything else).
     * This distinguishes document type restrictions from quota exhaustion.
     *
     * **Validates: Requirement 2.2**
     */
    it("blocked response has status 403 for any free-tier blocked type (property-based)", () => {
      const blockedTypes = fc.constantFrom(...FREE_TIER_BLOCKED)
      fc.assert(
        fc.property(blockedTypes, (docType) => {
          const result = checkDocumentTypeAllowed(docType, "free")
          expect(result).not.toBeNull()
          expect(result?.status).toBe(403)
        }),
        { numRuns: 200 }
      )
    })
  })
})
