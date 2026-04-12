/**
 * Property 5: Clarification flag prevents data application
 * Feature: profile-update-ai-improvements
 * 
 * Validates that when needsClarification is true, no data updates are applied
 * regardless of what extractedData contains.
 */
import { describe, it, expect, vi } from "vitest"
import * as fc from "fast-check"

/**
 * Simulates the clarification guard logic from handleSendMessage.
 * Returns true if applyUpdates would be called, false otherwise.
 */
function wouldApplyUpdates(result: {
  needsClarification: boolean
  extractedData: Record<string, unknown>
  message?: string
}): boolean {
  if (result.needsClarification) {
    // Clarification path: never apply updates
    return false
  } else if (result.extractedData && Object.keys(result.extractedData).length > 0) {
    // Data extraction path: would apply updates
    return true
  }
  // No data path: no updates
  return false
}

describe("Property 5: Clarification flag prevents data application", () => {
  it("should never apply updates when needsClarification is true, regardless of extractedData", () => {
    const nonEmptyString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)

    fc.assert(
      fc.property(
        // Generate arbitrary extractedData objects (could be empty or full)
        fc.dictionary(
          fc.constantFrom(
            "businessName", "email", "phone", "country",
            "businessType", "ownerName", "defaultCurrency",
            "paymentTerms", "additionalNotes"
          ),
          fc.oneof(nonEmptyString, fc.constant(null), fc.constant(undefined), fc.constant("")),
          { minKeys: 0, maxKeys: 9 }
        ),
        fc.option(nonEmptyString, { nil: undefined }),
        (extractedData, message) => {
          const result = {
            needsClarification: true,
            extractedData,
            message,
          }

          // When needsClarification is true, applyUpdates must NOT be called
          expect(wouldApplyUpdates(result)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should apply updates when needsClarification is false and extractedData is non-empty", () => {
    const nonEmptyString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)

    fc.assert(
      fc.property(
        // Generate non-empty extractedData
        fc.dictionary(
          fc.constantFrom("businessName", "email", "phone"),
          nonEmptyString,
          { minKeys: 1, maxKeys: 3 }
        ),
        (extractedData) => {
          const result = {
            needsClarification: false,
            extractedData,
          }

          // When needsClarification is false and data exists, should apply
          expect(wouldApplyUpdates(result)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
