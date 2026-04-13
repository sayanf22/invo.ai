/**
 * Property-based tests for brute force detection and reset
 * Feature: security-hardening, Property 4: Brute force detection and reset
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  checkBruteForce,
  recordFailedLogin,
  resetBruteForce,
  BRUTE_FORCE_MAX_ATTEMPTS,
  BRUTE_FORCE_BLOCK_DURATION_MS,
  type BruteForceEntry,
} from "@/lib/middleware-security"

describe("Feature: security-hardening, Property 4: Brute force detection and reset", () => {
  /**
   * Validates: Requirements 5.2, 5.4
   *
   * For any IP address, after 5 or more consecutive failed login attempts
   * within 15 minutes, subsequent requests to auth routes SHALL be blocked
   * for 15 minutes. After a successful login, the failed attempt counter
   * SHALL reset to 0, allowing immediate access.
   */

  it("blocks an IP after exactly 5 consecutive failed login attempts", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        (ip) => {
          const store = new Map<string, BruteForceEntry>()
          const now = Date.now()

          // First 4 failures should not trigger a block
          for (let i = 0; i < BRUTE_FORCE_MAX_ATTEMPTS - 1; i++) {
            const blocked = recordFailedLogin(ip, store, now + i)
            expect(blocked).toBe(false)
            const check = checkBruteForce(ip, store, now + i)
            expect(check.blocked).toBe(false)
          }

          // The 5th failure should trigger a block
          const blocked = recordFailedLogin(ip, store, now + BRUTE_FORCE_MAX_ATTEMPTS - 1)
          expect(blocked).toBe(true)

          // Subsequent check should show blocked
          const check = checkBruteForce(ip, store, now + BRUTE_FORCE_MAX_ATTEMPTS)
          expect(check.blocked).toBe(true)
          expect(check.retryAfter).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("unblocks an IP after the 15-minute block duration expires", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        (ip) => {
          const store = new Map<string, BruteForceEntry>()
          const now = Date.now()

          // Trigger block — all failures at the same timestamp for simplicity
          for (let i = 0; i < BRUTE_FORCE_MAX_ATTEMPTS; i++) {
            recordFailedLogin(ip, store, now)
          }

          // Should be blocked now
          const blocked = checkBruteForce(ip, store, now + 1)
          expect(blocked.blocked).toBe(true)

          // After 15 minutes from the block time, should be unblocked
          const afterBlock = now + BRUTE_FORCE_BLOCK_DURATION_MS + 1
          const unblocked = checkBruteForce(ip, store, afterBlock)
          expect(unblocked.blocked).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("successful login resets the failed attempt counter to 0", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 1, max: BRUTE_FORCE_MAX_ATTEMPTS - 1 }),
        (ip, failCount) => {
          const store = new Map<string, BruteForceEntry>()
          const now = Date.now()

          // Record some failures (less than threshold)
          for (let i = 0; i < failCount; i++) {
            recordFailedLogin(ip, store, now + i)
          }

          // Successful login resets the counter
          resetBruteForce(ip, store)

          // The entry should be gone
          expect(store.has(ip)).toBe(false)

          // Can now fail again up to the threshold without being blocked
          for (let i = 0; i < BRUTE_FORCE_MAX_ATTEMPTS - 1; i++) {
            const blocked = recordFailedLogin(ip, store, now + 1000 + i)
            expect(blocked).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("successful login after block resets counter and allows immediate access", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        (ip) => {
          const store = new Map<string, BruteForceEntry>()
          const now = Date.now()

          // Trigger block
          for (let i = 0; i < BRUTE_FORCE_MAX_ATTEMPTS; i++) {
            recordFailedLogin(ip, store, now + i)
          }

          // Verify blocked
          const blocked = checkBruteForce(ip, store, now + BRUTE_FORCE_MAX_ATTEMPTS)
          expect(blocked.blocked).toBe(true)

          // Successful login resets everything
          resetBruteForce(ip, store)

          // Should be immediately unblocked
          const check = checkBruteForce(ip, store, now + BRUTE_FORCE_MAX_ATTEMPTS + 1)
          expect(check.blocked).toBe(false)
          expect(check.retryAfter).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("different IPs have independent brute force tracking", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.ipV4(),
        (ip1, ip2) => {
          fc.pre(ip1 !== ip2)
          const store = new Map<string, BruteForceEntry>()
          const now = Date.now()

          // Block ip1
          for (let i = 0; i < BRUTE_FORCE_MAX_ATTEMPTS; i++) {
            recordFailedLogin(ip1, store, now + i)
          }

          // ip1 should be blocked
          const ip1Check = checkBruteForce(ip1, store, now + BRUTE_FORCE_MAX_ATTEMPTS)
          expect(ip1Check.blocked).toBe(true)

          // ip2 should not be blocked
          const ip2Check = checkBruteForce(ip2, store, now)
          expect(ip2Check.blocked).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("block duration is exactly 15 minutes", () => {
    expect(BRUTE_FORCE_BLOCK_DURATION_MS).toBe(15 * 60_000)
    expect(BRUTE_FORCE_MAX_ATTEMPTS).toBe(5)
  })
})
