/**
 * Property-based tests for CSRF module
 * Feature: security-hardening, Properties 1 and 2
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { NextRequest } from "next/server"
import { generateCSRFToken, validateCSRFToken, getCSRFSecret } from "@/lib/csrf"

// Mock the audit-log module so we don't need a real Supabase client
vi.mock("@/lib/audit-log", () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
}))

// Set CSRF_SECRET for tests
beforeEach(() => {
    process.env.CSRF_SECRET = "test-csrf-secret-that-is-long-enough-for-hmac-signing-purposes"
})

/**
 * Helper: create a NextRequest with a given method and optional CSRF token header
 */
function makeRequest(method: string, csrfToken?: string): NextRequest {
    const headers: Record<string, string> = {}
    if (csrfToken) {
        headers["x-csrf-token"] = csrfToken
    }
    return new NextRequest("http://localhost:3000/api/test", {
        method,
        headers,
    })
}

describe("Feature: security-hardening, Property 1: CSRF method filtering", () => {
    /**
     * Validates: Requirements 1.1
     *
     * For any HTTP request, the CSRF validator SHALL require token validation
     * if and only if the method is POST, PUT, or DELETE. GET, HEAD, and OPTIONS
     * requests SHALL skip CSRF validation entirely.
     */
    it("GET, HEAD, and OPTIONS requests skip CSRF validation (return null)", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom("GET", "HEAD", "OPTIONS"),
                fc.uuid(),
                async (method, sessionId) => {
                    const request = makeRequest(method)
                    const result = await validateCSRFToken(request, sessionId)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("POST, PUT, and DELETE requests without token return 403", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom("POST", "PUT", "DELETE"),
                fc.uuid(),
                async (method, sessionId) => {
                    const request = makeRequest(method) // no token
                    const result = await validateCSRFToken(request, sessionId)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })
})

describe("Feature: security-hardening, Property 2: CSRF token round-trip integrity", () => {
    /**
     * Validates: Requirements 1.3
     *
     * For any valid session ID, generating a CSRF token and then validating it
     * with the same session ID SHALL succeed. Validating a token with a different
     * session ID, a mutated signature, or after the 1-hour expiration SHALL fail
     * with a 403 response.
     */
    it("a generated token validates successfully with the same session ID", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const token = generateCSRFToken(sessionId)
                    const request = makeRequest("POST", token)
                    const result = await validateCSRFToken(request, sessionId)
                    expect(result).toBeNull()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("a generated token fails validation with a different session ID", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.uuid().filter((id2) => id2 !== ""),
                async (sessionId, otherSessionId) => {
                    fc.pre(sessionId !== otherSessionId)
                    const token = generateCSRFToken(sessionId)
                    const request = makeRequest("POST", token)
                    const result = await validateCSRFToken(request, otherSessionId)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("a token with a mutated signature fails validation", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.integer({ min: 0, max: 63 }),
                async (sessionId, mutateIndex) => {
                    const token = generateCSRFToken(sessionId)
                    const parts = token.split(":")
                    const sig = parts[3]
                    // Flip one hex character in the signature
                    const chars = sig.split("")
                    const original = chars[mutateIndex]
                    chars[mutateIndex] = original === "a" ? "b" : "a"
                    parts[3] = chars.join("")
                    const mutatedToken = parts.join(":")

                    const request = makeRequest("POST", mutatedToken)
                    const result = await validateCSRFToken(request, sessionId)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("an expired token (>1 hour) fails validation", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                async (sessionId) => {
                    const token = generateCSRFToken(sessionId)
                    const parts = token.split(":")
                    // Set timestamp to 2 hours ago
                    const expiredTimestamp = (Date.now() - 2 * 3600000).toString()
                    parts[2] = expiredTimestamp

                    // Re-sign with the expired timestamp so signature is valid
                    // but the token should still fail due to expiration
                    const { createHmac } = await import("crypto")
                    const payload = `${parts[0]}:${parts[1]}:${parts[2]}`
                    const hmac = createHmac("sha256", getCSRFSecret())
                    hmac.update(payload)
                    parts[3] = hmac.digest("hex")

                    const expiredToken = parts.join(":")
                    const request = makeRequest("POST", expiredToken)
                    const result = await validateCSRFToken(request, sessionId)
                    expect(result).not.toBeNull()
                    expect(result!.status).toBe(403)
                }
            ),
            { numRuns: 100 }
        )
    })
})
