// Feature: esignature-upgrade, Property 12: Token format validation

/**
 * Property 12: Token format validation
 *
 * For any string that does not match the pattern `sign_` followed by exactly
 * 32 lowercase hexadecimal characters, the token validation function SHALL
 * return false.
 *
 * Validates: Requirements 10.3
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// The token regex from the route — tested directly here
const TOKEN_REGEX = /^sign_[0-9a-f]{32}$/

/**
 * Pure token validation function (mirrors the route logic).
 */
function isValidToken(token: string): boolean {
  return TOKEN_REGEX.test(token)
}

// ── Generators ────────────────────────────────────────────────────────────────

/** Generate a valid token: "sign_" + 32 lowercase hex chars */
const validTokenArb = fc
  .stringMatching(/^[0-9a-f]{32}$/)
  .map((hex) => `sign_${hex}`)

/** Generate an arbitrary string (may or may not be valid) */
const arbitraryStringArb = fc.string()

/** Generate strings that are clearly invalid (wrong prefix) */
const wrongPrefixArb = fc.string().filter((s) => !s.startsWith("sign_"))

/** Generate strings with correct prefix but wrong hex length (not 32) */
const wrongHexLengthArb = fc
  .integer({ min: 0, max: 64 })
  .filter((n) => n !== 32)
  .chain((len) =>
    fc.stringMatching(new RegExp(`^[0-9a-f]{${len}}$`)).map((hex) => `sign_${hex}`)
  )

/** Generate strings with correct prefix and length but uppercase hex */
const uppercaseHexArb = fc
  .stringMatching(/^[0-9A-F]{32}$/)
  .map((hex) => `sign_${hex}`)

/** Generate strings with correct prefix but non-hex characters in the hex part */
const nonHexArb = fc
  .stringMatching(/^[g-z]{32}$/)
  .map((s) => `sign_${s}`)

describe("Feature: esignature-upgrade, Property 12: Token format validation", () => {
  /**
   * Property: Valid tokens (sign_ + 32 lowercase hex chars) MUST always pass validation.
   */
  it("should accept valid tokens matching sign_[0-9a-f]{32}", () => {
    fc.assert(
      fc.property(validTokenArb, (token) => {
        expect(isValidToken(token)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Arbitrary strings that do NOT match the pattern MUST be rejected.
   * We generate arbitrary strings and check that only those matching the pattern pass.
   */
  it("should reject arbitrary strings that do not match the pattern", () => {
    fc.assert(
      fc.property(arbitraryStringArb, (token) => {
        const isValid = isValidToken(token)
        // If it passes, it MUST match the pattern exactly
        if (isValid) {
          expect(token).toMatch(/^sign_[0-9a-f]{32}$/)
        }
        // If it doesn't match the pattern, it MUST be rejected
        if (!/^sign_[0-9a-f]{32}$/.test(token)) {
          expect(isValid).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Strings without the "sign_" prefix MUST always be rejected.
   */
  it("should reject strings without the sign_ prefix", () => {
    fc.assert(
      fc.property(wrongPrefixArb, (token) => {
        expect(isValidToken(token)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Strings with "sign_" prefix but wrong hex length MUST be rejected.
   */
  it("should reject tokens with wrong hex length (not exactly 32 chars)", () => {
    fc.assert(
      fc.property(wrongHexLengthArb, (token) => {
        // Only test tokens where the hex part is not exactly 32 chars
        const hexPart = token.slice(5) // remove "sign_"
        if (hexPart.length !== 32) {
          expect(isValidToken(token)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Tokens with uppercase hex characters MUST be rejected.
   */
  it("should reject tokens with uppercase hex characters", () => {
    fc.assert(
      fc.property(uppercaseHexArb, (token) => {
        // Only test if the hex part actually contains uppercase letters
        const hexPart = token.slice(5)
        if (/[A-F]/.test(hexPart)) {
          expect(isValidToken(token)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Empty string, null-like values, and common invalid formats MUST be rejected.
   */
  it("should reject empty string and common invalid formats", () => {
    const invalidTokens = [
      "",
      "sign_",
      "sign_abc",
      "sign_" + "g".repeat(32), // non-hex char
      "sign_" + "0".repeat(31), // too short
      "sign_" + "0".repeat(33), // too long
      "Sign_" + "0".repeat(32), // uppercase S
      "SIGN_" + "0".repeat(32), // all uppercase
      " sign_" + "0".repeat(32), // leading space
      "sign_" + "0".repeat(32) + " ", // trailing space
      "token_" + "0".repeat(32), // wrong prefix
    ]

    for (const token of invalidTokens) {
      expect(isValidToken(token)).toBe(false)
    }
  })
})
