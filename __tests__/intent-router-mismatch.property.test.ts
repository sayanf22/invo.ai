/**
 * Property 11: Mismatch detection correctness
 *
 * For any mismatch rule and prompt matching its triggerPattern with the
 * rule's requestedType, `detectMismatch` returns the rule's suggestedType.
 *
 * This test covers all 9 mismatch rules (4 original + 5 new), verifying
 * that for each rule, any prompt containing the trigger phrase (surrounded
 * by safe filler words) and the matching requestedType returns the
 * correct suggestedType.
 *
 * Original rules:
 *   Rule 1: contract + payment        → invoice          (Req 13.1)
 *   Rule 2: invoice  + agreement      → contract         (Req 13.1)
 *   Rule 3: quote    + already agreed → invoice          (Req 13.1)
 *   Rule 4: proposal + price list     → quote            (Req 13.1)
 *
 * New rules (Requirements 13.2–13.6):
 *   Rule 5: proposal + deliverables   → sow              (Req 13.2)
 *   Rule 6: contract + amendment      → change_order     (Req 13.3)
 *   Rule 7: invoice  + overdue        → payment_followup (Req 13.4)
 *   Rule 8: contract + confidential   → nda              (Req 13.5)
 *   Rule 9: quote    + collect payment→ invoice          (Req 13.6)
 *
 * **Validates: Requirements 13.1–13.6**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { detectMismatch, MISMATCH_RULES, type DocumentType } from "@/lib/intent-router"

// ─── Safe filler words ────────────────────────────────────────────────────────
//
// These words do NOT appear in any mismatch rule's triggerPattern, so they
// can safely be placed around trigger phrases without accidentally firing
// a different (or earlier) rule.
//
// Verified against all 9 rule patterns — none of these match:
//   Rule 1: payment|bill|invoice|charge|amount due|pay me|collect payment
//   Rule 2: agreement|terms|employment|hire|freelance agreement|...
//   Rule 3: already agreed|final price|payment due|invoice for|bill for
//   Rule 4: price list|line items|unit price|per hour|per unit|rate card
//   Rule 5: deliverables|milestones|acceptance criteria|timeline|phases
//   Rule 6: change|amendment|scope change|modification|revision|addendum
//   Rule 7: reminder|follow.?up|overdue|past due|outstanding|unpaid invoice
//   Rule 8: confidential|nda|non-disclosure|secret|proprietary
//   Rule 9: already agreed|final price|payment due|collect payment|invoice for

const SAFE_FILLER_WORDS = [
  "please",
  "for",
  "my",
  "the",
  "a",
  "client",
  "project",
  "new",
  "document",
  "help",
  "today",
  "important",
  "about",
  "with",
  "and",
  "prepare",
  "draft",
  "now",
]

const safeFillerArb = fc
  .array(fc.constantFrom(...SAFE_FILLER_WORDS), { minLength: 0, maxLength: 4 })
  .map((words) => words.filter(Boolean).join(" ").trim())

// ─── Test scenarios ───────────────────────────────────────────────────────────

interface MismatchScenario {
  description: string
  requestedType: DocumentType
  /**
   * The keyword phrase from the rule's triggerPattern. Chosen so it:
   * 1. Matches the intended rule's triggerPattern.
   * 2. Does NOT match any earlier rule for the same requestedType, so
   *    rule ordering does not produce a different suggestedType than expected.
   */
  triggerPhrase: string
  expectedSuggestedType: DocumentType
}

const SCENARIOS: MismatchScenario[] = [
  // ── 4 original rules ────────────────────────────────────────────────────
  {
    description: "Rule 1 (Req 13.1): contract + payment → invoice",
    requestedType: "contract",
    triggerPhrase: "payment",
    expectedSuggestedType: "invoice",
  },
  {
    description: "Rule 2 (Req 13.1): invoice + agreement → contract",
    requestedType: "invoice",
    triggerPhrase: "agreement",
    expectedSuggestedType: "contract",
  },
  {
    description: "Rule 3 (Req 13.1): quote + already agreed → invoice",
    requestedType: "quote",
    triggerPhrase: "already agreed",
    expectedSuggestedType: "invoice",
  },
  {
    description: "Rule 4 (Req 13.1): proposal + price list → quote",
    requestedType: "proposal",
    triggerPhrase: "price list",
    expectedSuggestedType: "quote",
  },
  // ── 5 new rules (Requirements 13.2–13.6) ────────────────────────────────
  {
    description: "Rule 5 (Req 13.2): proposal + deliverables → sow",
    requestedType: "proposal",
    // "deliverables" matches Rule 5; Rule 4 (price list/line items) does not
    // fire because "deliverables" is not in Rule 4's pattern.
    triggerPhrase: "deliverables",
    expectedSuggestedType: "sow",
  },
  {
    description:
      "Rule 6 (Req 13.3): contract + amendment → change_order (amendment alone, no payment words)",
    requestedType: "contract",
    // "amendment" matches Rule 6; Rule 1 (payment/bill/invoice) does not fire
    // because "amendment" is not in Rule 1's pattern.
    triggerPhrase: "amendment",
    expectedSuggestedType: "change_order",
  },
  {
    description:
      "Rule 7 (Req 13.4): invoice + overdue → payment_followup (overdue alone, no agreement words)",
    requestedType: "invoice",
    // "overdue" matches Rule 7; Rule 2 (agreement/terms/employment) does not fire
    // because "overdue" is not in Rule 2's pattern.
    triggerPhrase: "overdue",
    expectedSuggestedType: "payment_followup",
  },
  {
    description: "Rule 8 (Req 13.5): contract + confidential → nda",
    requestedType: "contract",
    // "confidential" matches Rule 8; Rules 1 and 6 for contract do not fire
    // because "confidential" is not in their patterns.
    triggerPhrase: "confidential",
    expectedSuggestedType: "nda",
  },
  {
    description:
      "Rule 3 re-check (Req 13.6): quote + already agreed still fires rule 3 → invoice",
    requestedType: "quote",
    // Both Rule 3 and Rule 9 include "already agreed"; Rule 3 fires first
    // (it appears earlier in MISMATCH_RULES). Both return "invoice".
    triggerPhrase: "already agreed",
    expectedSuggestedType: "invoice",
  },
  {
    description:
      "Rule 9 new keyword (Req 13.6): quote + collect payment → invoice",
    requestedType: "quote",
    // "collect payment" is ONLY in Rule 9's pattern (not Rule 3's), so Rule 3
    // does not fire. Rule 9 fires and returns "invoice".
    triggerPhrase: "collect payment",
    expectedSuggestedType: "invoice",
  },
]

// ─── Property 11 tests ────────────────────────────────────────────────────────

describe(
  "Feature: service-business-document-workflow, Property 11: Mismatch detection correctness",
  () => {
    // ── Per-rule tests ───────────────────────────────────────────────────────

    for (const scenario of SCENARIOS) {
      it(scenario.description, () => {
        /**
         * Validates: Requirements 13.1–13.6
         *
         * For any prompt containing the trigger phrase (with safe filler prefix and
         * suffix), `detectMismatch(prompt, requestedType)` SHALL:
         *   1. Return a non-null MismatchResult.
         *   2. Have `suggestedType` equal to the expected type.
         *   3. Have `requestedType` equal to the input requestedType.
         */
        fc.assert(
          fc.property(safeFillerArb, safeFillerArb, (prefix, suffix) => {
            const parts = [prefix, scenario.triggerPhrase, suffix].filter(Boolean)
            const prompt = parts.join(" ").trim()

            const result = detectMismatch(prompt, scenario.requestedType)

            expect(
              result,
              `Expected a mismatch for prompt "${prompt}" with requestedType "${scenario.requestedType}"`
            ).not.toBeNull()
            expect(result!.suggestedType).toBe(scenario.expectedSuggestedType)
            expect(result!.requestedType).toBe(scenario.requestedType)
            expect(result!.reason).toBeTruthy()
          }),
          { numRuns: 50 }
        )
      })
    }

    // ── Negative case: types with no mismatch rules always return null ────────

    const TYPES_WITH_NO_RULES: DocumentType[] = [
      "sow",
      "change_order",
      "nda",
      "client_onboarding_form",
      "payment_followup",
      "recurring_invoice",
    ]

    it("detectMismatch returns null for document types that have no mismatch rules", () => {
      /**
       * Validates: Requirements 13.1–13.6
       *
       * For document types that have no entry in MISMATCH_RULES as a
       * `requestedType`, any prompt SHALL return null.
       */
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          fc.constantFrom(...TYPES_WITH_NO_RULES),
          (prompt, docType) => {
            const result = detectMismatch(prompt, docType)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    // ── Negative case: prompts with no trigger keywords return null ───────────

    it("detectMismatch returns null when prompt contains only safe (non-trigger) words", () => {
      /**
       * Validates: Requirements 13.1–13.6
       *
       * A prompt built solely from safe filler words SHALL produce no mismatch
       * for any document type, because no rule's triggerPattern is satisfied.
       */
      fc.assert(
        fc.property(
          fc
            .array(fc.constantFrom(...SAFE_FILLER_WORDS), { minLength: 1, maxLength: 8 })
            .map((words) => words.join(" ")),
          fc.constantFrom<DocumentType>(
            "contract",
            "invoice",
            "quote",
            "proposal",
            "sow",
            "change_order",
            "nda",
            "client_onboarding_form",
            "payment_followup",
            "recurring_invoice"
          ),
          (prompt, docType) => {
            const result = detectMismatch(prompt, docType)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    // ── Structural check: MISMATCH_RULES contains all 10 expected rules ───────

    it("MISMATCH_RULES array contains exactly 10 rules with all required fields", () => {
      /**
       * Validates that the rule table has the expected number of entries
       * and that each rule contains the required fields. (10th rule added for
       * the estimate → quote firm-price redirect.)
       */
      expect(MISMATCH_RULES.length).toBe(10)

      for (const rule of MISMATCH_RULES) {
        expect(typeof rule.requestedType).toBe("string")
        expect(typeof rule.suggestedType).toBe("string")
        expect(typeof rule.reason).toBe("string")
        expect(rule.reason.length).toBeGreaterThan(0)
        expect(rule.triggerPattern).toBeInstanceOf(RegExp)
      }
    })

    // ── Structural check: rule ordering — contract rules fire in expected order ─

    it("for contract type: Rule 1 (payment→invoice) fires before Rule 6 (amendment→change_order)", () => {
      /**
       * Validates: Requirement 13.3
       *
       * When a prompt contains BOTH a payment keyword AND an amendment keyword
       * for requestedType="contract", Rule 1 fires first (it appears earlier)
       * and the result is suggestedType="invoice", not "change_order".
       */
      const prompt = "payment amendment for contract work"
      const result = detectMismatch(prompt, "contract")
      expect(result).not.toBeNull()
      // Rule 1 fires first: payment → invoice
      expect(result!.suggestedType).toBe("invoice")
    })

    it("for invoice type: Rule 2 (agreement→contract) fires before Rule 7 (overdue→payment_followup)", () => {
      /**
       * Validates: Requirement 13.4
       *
       * When a prompt contains BOTH an agreement keyword AND an overdue keyword
       * for requestedType="invoice", Rule 2 fires first and returns "contract".
       */
      const prompt = "agreement overdue for invoice client"
      const result = detectMismatch(prompt, "invoice")
      expect(result).not.toBeNull()
      // Rule 2 fires first: agreement → contract
      expect(result!.suggestedType).toBe("contract")
    })
  }
)
