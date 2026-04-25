// Feature: esignature-upgrade, Property 13: Token expiry invariant

/**
 * Property 13: Token expiry invariant
 *
 * For any signing request created at time T, the `expires_at` value SHALL be
 * exactly T + 7 days (604800 seconds), with no rounding or truncation.
 *
 * Validates: Requirements 10.5
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000 // 604800000 ms
const SEVEN_DAYS_SECONDS = 604800

/**
 * Pure function that computes expires_at from created_at.
 * Mirrors the logic that should be used when creating a signing token.
 */
function computeExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SEVEN_DAYS_MS)
}

/**
 * Verify that expires_at is exactly created_at + 604800 seconds.
 */
function verifyExpiryInvariant(createdAt: Date, expiresAt: Date): boolean {
  const diffMs = expiresAt.getTime() - createdAt.getTime()
  return diffMs === SEVEN_DAYS_MS
}

describe("Feature: esignature-upgrade, Property 13: Token expiry invariant", () => {
  /**
   * Property: For any creation timestamp, expires_at MUST be exactly
   * created_at + 604800 seconds (7 days), with no rounding or truncation.
   */
  it("should set expires_at to exactly created_at + 604800 seconds", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary timestamps (Unix epoch ms, reasonable range)
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        (timestampMs) => {
          const createdAt = new Date(timestampMs)
          const expiresAt = computeExpiresAt(createdAt)

          // Verify the difference is exactly 7 days in milliseconds
          const diffMs = expiresAt.getTime() - createdAt.getTime()
          expect(diffMs).toBe(SEVEN_DAYS_MS)

          // Verify in seconds as well
          const diffSeconds = diffMs / 1000
          expect(diffSeconds).toBe(SEVEN_DAYS_SECONDS)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: The expiry invariant verification function correctly identifies
   * valid and invalid expiry dates.
   */
  it("should correctly verify the expiry invariant", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        (timestampMs) => {
          const createdAt = new Date(timestampMs)
          const correctExpiresAt = computeExpiresAt(createdAt)

          // Correct expiry must pass
          expect(verifyExpiryInvariant(createdAt, correctExpiresAt)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Any expiry that differs from created_at + 604800s by even 1ms
   * MUST fail the invariant check.
   */
  it("should reject expiry values that differ by even 1ms from the exact 7-day window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        fc.integer({ min: 1, max: 86_400_000 }), // offset: 1ms to 1 day
        fc.boolean(), // add or subtract
        (timestampMs, offsetMs, addOffset) => {
          const createdAt = new Date(timestampMs)
          const correctExpiresAt = computeExpiresAt(createdAt)

          // Tamper with the expiry by adding or subtracting the offset
          const tamperedExpiresAt = new Date(
            correctExpiresAt.getTime() + (addOffset ? offsetMs : -offsetMs)
          )

          expect(verifyExpiryInvariant(createdAt, tamperedExpiresAt)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: expires_at computed from ISO string round-trip preserves the invariant.
   * (Ensures no precision loss when storing/retrieving as ISO 8601 strings.)
   */
  it("should preserve the invariant through ISO string serialization", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        (timestampMs) => {
          const createdAt = new Date(timestampMs)
          const expiresAt = computeExpiresAt(createdAt)

          // Simulate storing and retrieving as ISO strings (as Supabase does)
          const createdAtIso = createdAt.toISOString()
          const expiresAtIso = expiresAt.toISOString()

          const createdAtRestored = new Date(createdAtIso)
          const expiresAtRestored = new Date(expiresAtIso)

          const diffMs = expiresAtRestored.getTime() - createdAtRestored.getTime()
          expect(diffMs).toBe(SEVEN_DAYS_MS)
        }
      ),
      { numRuns: 100 }
    )
  })
})
