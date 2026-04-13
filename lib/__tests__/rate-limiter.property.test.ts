/**
 * Property-based tests for IP-based rate limit enforcement
 * Feature: security-hardening, Property 3: IP-based rate limit enforcement
 */

import { describe, it, expect, beforeEach } from "vitest"
import * as fc from "fast-check"
import {
  RATE_LIMITS,
  checkIPRateLimit,
  getRouteCategory,
  type RateLimitCategory,
  type RateLimitEntry,
} from "@/lib/middleware-security"

describe("Feature: security-hardening, Property 3: IP-based rate limit enforcement", () => {
  /**
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1, 12.5
   *
   * For any IP address and route category (auth: 10/min, api: 120/min,
   * signing: 5/min, webhook: 30/min, global: 300/min), after exactly N
   * requests within the time window where N equals the configured limit,
   * the (N+1)th request SHALL be rejected with a 429 status and a positive
   * Retry-After header value.
   */

  it("allows exactly maxRequests and rejects the (N+1)th request for any category", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RateLimitCategory>("auth", "api", "signing", "webhook", "global"),
        fc.ipV4(),
        (category, ip) => {
          const store = new Map<string, RateLimitEntry>()
          const config = RATE_LIMITS[category]
          const now = Date.now()

          // Make exactly maxRequests — all should be allowed
          for (let i = 0; i < config.maxRequests; i++) {
            const result = checkIPRateLimit(ip, category, store, now + i)
            expect(result.allowed).toBe(true)
            expect(result.retryAfter).toBe(0)
          }

          // The (N+1)th request should be rejected
          const rejected = checkIPRateLimit(ip, category, store, now + config.maxRequests)
          expect(rejected.allowed).toBe(false)
          expect(rejected.retryAfter).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("allows requests again after the time window expires", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RateLimitCategory>("auth", "api", "signing", "webhook", "global"),
        fc.ipV4(),
        (category, ip) => {
          const store = new Map<string, RateLimitEntry>()
          const config = RATE_LIMITS[category]
          const now = Date.now()

          // Exhaust the limit
          for (let i = 0; i < config.maxRequests; i++) {
            checkIPRateLimit(ip, category, store, now + i)
          }

          // Verify blocked
          const blocked = checkIPRateLimit(ip, category, store, now + config.maxRequests)
          expect(blocked.allowed).toBe(false)

          // After the window expires, requests should be allowed again
          const afterWindow = now + config.windowMs + 1
          const allowed = checkIPRateLimit(ip, category, store, afterWindow)
          expect(allowed.allowed).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("different IPs have independent rate limits", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RateLimitCategory>("auth", "signing"),
        fc.ipV4(),
        fc.ipV4(),
        (category, ip1, ip2) => {
          fc.pre(ip1 !== ip2)
          const store = new Map<string, RateLimitEntry>()
          const config = RATE_LIMITS[category]
          const now = Date.now()

          // Exhaust limit for ip1
          for (let i = 0; i < config.maxRequests; i++) {
            checkIPRateLimit(ip1, category, store, now + i)
          }

          // ip1 should be blocked
          const ip1Check = checkIPRateLimit(ip1, category, store, now + config.maxRequests)
          expect(ip1Check.allowed).toBe(false)

          // ip2 should still be allowed
          const ip2Check = checkIPRateLimit(ip2, category, store, now)
          expect(ip2Check.allowed).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rate limit config values match the spec", () => {
    expect(RATE_LIMITS.auth.maxRequests).toBe(10)
    expect(RATE_LIMITS.api.maxRequests).toBe(120)
    expect(RATE_LIMITS.signing.maxRequests).toBe(5)
    expect(RATE_LIMITS.webhook.maxRequests).toBe(30)
    expect(RATE_LIMITS.global.maxRequests).toBe(300)

    // All windows are 60 seconds
    for (const cat of Object.values(RATE_LIMITS)) {
      expect(cat.windowMs).toBe(60_000)
    }
  })

  it("getRouteCategory correctly classifies routes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { path: "/auth/login", expected: "auth" as RateLimitCategory },
          { path: "/auth/signup", expected: "auth" as RateLimitCategory },
          { path: "/auth/callback", expected: "auth" as RateLimitCategory },
          { path: "/api/signatures/sign/abc", expected: "signing" as RateLimitCategory },
          { path: "/api/razorpay/webhook", expected: "webhook" as RateLimitCategory },
          { path: "/api/ai/stream", expected: "api" as RateLimitCategory },
          { path: "/api/sessions/create", expected: "api" as RateLimitCategory },
          { path: "/pricing", expected: "global" as RateLimitCategory },
          { path: "/", expected: "global" as RateLimitCategory },
        ),
        ({ path, expected }) => {
          expect(getRouteCategory(path)).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })
})
