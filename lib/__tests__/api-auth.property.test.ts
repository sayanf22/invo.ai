/**
 * Property-based tests for api-auth module
 * Feature: security-hardening, Properties 9, 15, and 17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import { validateBodySize, sanitizeError, validateOrigin } from "@/lib/api-auth"

// ── Property 9: Request body size enforcement ──────────────────────────

describe("Feature: security-hardening, Property 9: Request body size enforcement", () => {
    /**
     * Validates: Requirements 3.6
     *
     * For any request body and configured size limit, validateBodySize SHALL
     * return null (allow) when the serialized body size is ≤ the limit, and
     * SHALL return a 413 response when the size exceeds the limit.
     */
    it("returns null when serialized body size is within the limit", () => {
        fc.assert(
            fc.property(
                // Generate a small object that serializes to ≤ limit
                fc.integer({ min: 100, max: 10000 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                (limit, value) => {
                    const body = { key: value }
                    const serialized = JSON.stringify(body)
                    // Only test when body fits within limit
                    fc.pre(serialized.length <= limit)
                    const result = validateBodySize(body, limit)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("returns 413 when serialized body size exceeds the limit", () => {
        fc.assert(
            fc.property(
                // Generate a string long enough to exceed a small limit
                fc.string({ minLength: 10, maxLength: 500 }),
                fc.integer({ min: 1, max: 20 }),
                (value, limit) => {
                    const body = { data: value }
                    const serialized = JSON.stringify(body)
                    // Only test when body exceeds limit
                    fc.pre(serialized.length > limit)
                    const result = validateBodySize(body, limit)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(413)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("boundary: body exactly at limit returns null", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 200 }),
                (value) => {
                    const body = { v: value }
                    const serialized = JSON.stringify(body)
                    const limit = serialized.length // exactly at limit
                    const result = validateBodySize(body, limit)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })
})


// ── Property 15: Error message sanitization ────────────────────────────

describe("Feature: security-hardening, Property 15: Error message sanitization", () => {
    /**
     * Validates: Requirements 9.1, 9.2, 9.5
     *
     * For any Error object, sanitizeError SHALL return the original message only
     * if it matches a known safe message pattern. For all other errors, it SHALL
     * return "Internal server error" — never exposing stack traces, database
     * error codes, or internal paths.
     */

    const KNOWN_SAFE_MESSAGES = [
        "Prompt is required",
        "Missing required fields",
        "Rate limit exceeded",
        "Request body too large",
        "Invalid document type",
        "Invalid email format",
        "Invalid country code",
        "Invalid currency code",
        "CSRF token missing or invalid",
        "Monthly AI usage limit exceeded",
        "AI service temporarily unavailable. Please try again.",
        "Operation failed. Please try again.",
    ]

    it("returns original message for known safe messages", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...KNOWN_SAFE_MESSAGES),
                (safeMessage) => {
                    const error = new Error(safeMessage)
                    const result = sanitizeError(error)
                    expect(result).toBe(safeMessage)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("returns 'Internal server error' for unknown error messages", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 200 }).filter((s) => {
                    // Filter out strings that contain any safe message substring
                    return !KNOWN_SAFE_MESSAGES.some((safe) => s.includes(safe))
                }),
                (unknownMessage) => {
                    const error = new Error(unknownMessage)
                    const result = sanitizeError(error)
                    expect(result).toBe("Internal server error")
                }
            ),
            { numRuns: 100 }
        )
    })

    it("returns 'Internal server error' for non-Error values", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.string(),
                    fc.integer(),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.object()
                ),
                (nonError) => {
                    const result = sanitizeError(nonError)
                    expect(result).toBe("Internal server error")
                }
            ),
            { numRuns: 100 }
        )
    })

    it("never exposes stack traces or internal paths", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant("PGRST116: row not found"),
                    fc.constant("Error at /app/api/ai/stream/route.ts:42"),
                    fc.constant("connect ECONNREFUSED 127.0.0.1:5432"),
                    fc.constant("DeepSeek API key invalid: sk-abc123..."),
                    fc.constant("TypeError: Cannot read properties of undefined"),
                    fc.string({ minLength: 1, maxLength: 300 })
                ).filter((s) => !KNOWN_SAFE_MESSAGES.some((safe) => s.includes(safe))),
                (dangerousMessage) => {
                    const error = new Error(dangerousMessage)
                    const result = sanitizeError(error)
                    expect(result).toBe("Internal server error")
                    expect(result).not.toContain("PGRST")
                    expect(result).not.toContain("/app/")
                    expect(result).not.toContain("sk-")
                }
            ),
            { numRuns: 100 }
        )
    })
})


// ── Property 17: Origin validation ─────────────────────────────────────

describe("Feature: security-hardening, Property 17: Origin validation", () => {
    /**
     * Validates: Requirements 11.1, 11.3, 11.5
     *
     * For any request with an Origin header, validateOrigin SHALL accept only
     * origins in the allowed list and SHALL reject all others with 403. When
     * both Origin and Referer are absent on a state-changing request, it SHALL
     * return 403.
     */

    const originalEnv = { ...process.env }

    beforeEach(() => {
        process.env.NEXT_PUBLIC_APP_URL = "https://app.clorefy.com"
        process.env.VERCEL_URL = undefined
        Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true, configurable: true })
    })

    afterEach(() => {
        process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL
        process.env.VERCEL_URL = originalEnv.VERCEL_URL
        Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv.NODE_ENV, writable: true, configurable: true })
    })

    /** Helper to create a Request with specific headers */
    function makeOriginRequest(
        method: string,
        origin?: string,
        referer?: string
    ): Request {
        const headers: Record<string, string> = {}
        if (origin) headers["origin"] = origin
        if (referer) headers["referer"] = referer
        return new Request("http://localhost:3000/api/test", {
            method,
            headers,
        })
    }

    it("accepts requests from allowed origins", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    "https://clorefy.com",
                    "https://app.clorefy.com"
                ),
                fc.constantFrom("GET", "POST", "PUT", "DELETE"),
                (allowedOrigin, method) => {
                    const request = makeOriginRequest(method, allowedOrigin)
                    const result = validateOrigin(request)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("rejects requests from disallowed origins with 403", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant("https://evil.com"),
                    fc.constant("https://attacker.example.org"),
                    fc.constant("http://phishing-clorefy.com"),
                    fc.constant("https://clorefy.com.evil.com"),
                    fc.webUrl().filter(
                        (url) =>
                            !url.startsWith("https://clorefy.com") &&
                            !url.startsWith("https://app.clorefy.com") &&
                            !url.startsWith("http://localhost")
                    )
                ),
                fc.constantFrom("GET", "POST", "PUT", "DELETE"),
                (badOrigin, method) => {
                    const request = makeOriginRequest(method, badOrigin)
                    const result = validateOrigin(request)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("rejects state-changing requests when both Origin and Referer are absent", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("POST", "PUT", "DELETE", "PATCH"),
                (method) => {
                    const request = makeOriginRequest(method) // no origin, no referer
                    const result = validateOrigin(request)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("allows GET/HEAD/OPTIONS when both Origin and Referer are absent (same-origin)", () => {
        fc.assert(
            fc.property(
                fc.constantFrom("GET", "HEAD", "OPTIONS"),
                (method) => {
                    const request = makeOriginRequest(method) // no origin, no referer
                    const result = validateOrigin(request)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("does not allow localhost origins in production mode", () => {
        Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true, configurable: true })
        fc.assert(
            fc.property(
                fc.constantFrom("http://localhost:3000", "http://localhost:3001"),
                fc.constantFrom("GET", "POST"),
                (localhostOrigin, method) => {
                    const request = makeOriginRequest(method, localhostOrigin)
                    const result = validateOrigin(request)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("allows localhost origins in development mode", () => {
        Object.defineProperty(process.env, "NODE_ENV", { value: "development", writable: true, configurable: true })
        fc.assert(
            fc.property(
                fc.constantFrom("http://localhost:3000", "http://localhost:3001"),
                fc.constantFrom("GET", "POST"),
                (localhostOrigin, method) => {
                    const request = makeOriginRequest(method, localhostOrigin)
                    const result = validateOrigin(request)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("falls back to Referer validation when Origin is absent", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    "https://clorefy.com/some/page",
                    "https://app.clorefy.com/dashboard"
                ),
                fc.constantFrom("POST", "PUT", "DELETE"),
                (validReferer, method) => {
                    const request = makeOriginRequest(method, undefined, validReferer)
                    const result = validateOrigin(request)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("rejects invalid Referer when Origin is absent", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    "https://evil.com/fake",
                    "https://attacker.org/page"
                ),
                fc.constantFrom("POST", "PUT", "DELETE"),
                (badReferer, method) => {
                    const request = makeOriginRequest(method, undefined, badReferer)
                    const result = validateOrigin(request)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })
})
