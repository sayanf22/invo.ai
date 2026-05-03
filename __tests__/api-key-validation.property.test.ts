/**
 * Property-Based Tests for API Key Validation Boundary
 *
 * Feature: ai-dual-model-chat, Property 4: API key validation boundary at 10 characters
 * Uses: vitest + fast-check
 *
 * **Validates: Requirements 4.3**
 *
 * The Bedrock key guard in `app/api/ai/stream/route.ts` uses:
 *   if (bedrockKey && bedrockKey.length > 10) { ... }
 *
 * This means:
 * - Strings with length <= 10 (including empty) → guard is false → skip Kimi
 * - Strings with length > 10 (i.e., >= 11) → guard is true → attempt Kimi
 * - Falsy values (empty string, undefined, null) → guard is false → skip Kimi
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

/**
 * Pure function that replicates the Bedrock key guard logic from the route handler.
 * This is the exact condition used in `app/api/ai/stream/route.ts`:
 *   if (bedrockKey && bedrockKey.length > 10)
 */
function bedrockKeyGuard(bedrockKey: string | undefined | null): boolean {
  return !!(bedrockKey && bedrockKey.length > 10)
}

describe("Feature: ai-dual-model-chat, Property 4: API key validation boundary at 10 characters", () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * For any string of length <= 10 (including empty string),
   * the guard evaluates to false (skip Kimi, route to DeepSeek).
   */
  it("strings with length <= 10 cause the guard to evaluate to false (skip Kimi)", () => {
    const shortStringArb = fc.string({ minLength: 0, maxLength: 10 })

    fc.assert(
      fc.property(shortStringArb, (key) => {
        expect(bedrockKeyGuard(key)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3**
   *
   * For any string of length > 10 (i.e., >= 11),
   * the guard evaluates to true (attempt Kimi).
   */
  it("strings with length > 10 cause the guard to evaluate to true (attempt Kimi)", () => {
    const longStringArb = fc.string({ minLength: 11, maxLength: 50 })

    fc.assert(
      fc.property(longStringArb, (key) => {
        expect(bedrockKeyGuard(key)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3**
   *
   * Test the exact boundary: a 10-char string → false, an 11-char string → true.
   */
  it("exact boundary: 10-char string → false, 11-char string → true", () => {
    // Generate pairs of strings at the exact boundary
    const boundaryArb = fc.tuple(
      fc.string({ minLength: 10, maxLength: 10 }), // exactly 10 chars
      fc.string({ minLength: 11, maxLength: 11 })  // exactly 11 chars
    )

    fc.assert(
      fc.property(boundaryArb, ([tenChar, elevenChar]) => {
        expect(tenChar.length).toBe(10)
        expect(elevenChar.length).toBe(11)
        expect(bedrockKeyGuard(tenChar)).toBe(false)
        expect(bedrockKeyGuard(elevenChar)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3**
   *
   * Falsy values (undefined, null, empty string) always evaluate to false.
   */
  it("falsy values (undefined, null, empty string) evaluate to false", () => {
    const falsyArb = fc.constantFrom(undefined, null, "")

    fc.assert(
      fc.property(falsyArb, (key) => {
        expect(bedrockKeyGuard(key)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3**
   *
   * For any random string of length 0–50, the guard result is consistent
   * with the length > 10 rule.
   */
  it("for any string of length 0–50, guard result matches length > 10 rule", () => {
    const anyStringArb = fc.string({ minLength: 0, maxLength: 50 })

    fc.assert(
      fc.property(anyStringArb, (key) => {
        const expected = key.length > 10
        expect(bedrockKeyGuard(key)).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })
})
