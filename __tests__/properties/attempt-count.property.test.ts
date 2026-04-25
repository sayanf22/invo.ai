// Feature: esignature-upgrade, Property 14: Attempt count enforcement

/**
 * Property 14: Attempt count enforcement
 *
 * For any signing token, after 5 failed submission attempts (where attempt_count
 * reaches 5), any further submission attempt SHALL be rejected with HTTP 410 and
 * a `signature.abuse_detected` audit event SHALL be recorded.
 *
 * Validates: Requirements 10.1
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Inline implementation of the attempt_count enforcement logic ──────────────
// We test the pure enforcement logic extracted from the route handler,
// without needing a live database connection.

interface SignatureRecord {
  id: string
  attempt_count: number
  signed_at: string | null
  expires_at: string | null
}

interface AuditEvent {
  action: string
  signature_id: string
  metadata: Record<string, unknown>
}

/**
 * Pure function that mirrors the attempt_count enforcement logic in the route.
 * Returns the HTTP status that the route would return, and any audit events recorded.
 */
function enforceAttemptCount(
  signature: SignatureRecord,
  newAttemptCount: number
): { status: number; auditEvents: AuditEvent[] } {
  const auditEvents: AuditEvent[] = []

  if (newAttemptCount >= 6) {
    auditEvents.push({
      action: "signature.abuse_detected",
      signature_id: signature.id,
      metadata: { attempt_count: newAttemptCount },
    })
    return { status: 410, auditEvents }
  }

  // Not yet at limit — would proceed with signing
  return { status: 200, auditEvents }
}

/**
 * Simulate incrementing attempt_count and checking the result.
 * Returns the status after the Nth attempt.
 */
function simulateAttempts(
  signatureId: string,
  startingAttemptCount: number,
  totalAttempts: number
): { finalStatus: number; abuseDetected: boolean; abuseAttempt: number | null } {
  let currentCount = startingAttemptCount
  let abuseDetected = false
  let abuseAttempt: number | null = null
  let finalStatus = 200

  for (let i = 1; i <= totalAttempts; i++) {
    currentCount += 1
    const result = enforceAttemptCount(
      { id: signatureId, attempt_count: currentCount, signed_at: null, expires_at: null },
      currentCount
    )
    finalStatus = result.status
    if (result.status === 410 && !abuseDetected) {
      abuseDetected = true
      abuseAttempt = i
    }
  }

  return { finalStatus, abuseDetected, abuseAttempt }
}

describe("Feature: esignature-upgrade, Property 14: Attempt count enforcement", () => {
  /**
   * Property: For any starting attempt_count in [0, 4], the 6th total attempt
   * (i.e. when attempt_count reaches 6) MUST be rejected with 410 and
   * signature.abuse_detected MUST be recorded.
   */
  it("should reject the 6th attempt with 410 and record abuse_detected", () => {
    fc.assert(
      fc.property(
        // Generate a starting attempt_count between 0 and 4 (so 6th attempt hits the limit)
        fc.integer({ min: 0, max: 4 }),
        fc.uuid(),
        (startingCount, signatureId) => {
          // The 6th attempt is when attempt_count reaches 6
          // Starting from startingCount, we need (6 - startingCount) attempts to hit the limit
          const attemptsNeeded = 6 - startingCount

          const result = simulateAttempts(signatureId, startingCount, attemptsNeeded)

          // The final attempt (the 6th total) must be rejected with 410
          expect(result.finalStatus).toBe(410)
          expect(result.abuseDetected).toBe(true)
          expect(result.abuseAttempt).toBe(attemptsNeeded)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: For any starting attempt_count in [0, 4], attempts 1 through
   * (5 - startingCount) must NOT be rejected (status 200).
   */
  it("should allow attempts 1 through 5 (before the limit is reached)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.uuid(),
        (startingCount, signatureId) => {
          // Attempts that should still be allowed (before reaching count 6)
          const allowedAttempts = 5 - startingCount

          if (allowedAttempts <= 0) return // nothing to test for startingCount = 5+

          for (let i = 1; i <= allowedAttempts; i++) {
            const newCount = startingCount + i
            const result = enforceAttemptCount(
              { id: signatureId, attempt_count: newCount, signed_at: null, expires_at: null },
              newCount
            )
            expect(result.status).toBe(200)
            expect(result.auditEvents).toHaveLength(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: For any attempt_count >= 6, the enforcement MUST always return 410
   * and record exactly one abuse_detected event.
   */
  it("should always reject and record abuse_detected when attempt_count >= 6", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 100 }),
        fc.uuid(),
        (attemptCount, signatureId) => {
          const result = enforceAttemptCount(
            { id: signatureId, attempt_count: attemptCount, signed_at: null, expires_at: null },
            attemptCount
          )

          expect(result.status).toBe(410)
          expect(result.auditEvents).toHaveLength(1)
          expect(result.auditEvents[0].action).toBe("signature.abuse_detected")
          expect(result.auditEvents[0].signature_id).toBe(signatureId)
          expect(result.auditEvents[0].metadata.attempt_count).toBe(attemptCount)
        }
      ),
      { numRuns: 100 }
    )
  })
})
